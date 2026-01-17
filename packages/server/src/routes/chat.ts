import { Router, type Request, type Response } from 'express';
import { opencodeManager } from '../services/opencode.ts';
import { createOpencodeClient } from '@opencode-ai/sdk';
import type { OpencodeClient } from '@opencode-ai/sdk';

const router = Router();

interface ChatSession {
  id: string;
  prNumber: number;
  title: string;
  createdAt: number;
  messageCount: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// In-memory store for active chat sessions
const activeSessions = new Map<string, ChatSession>();

// Helper to get SDK client
async function getSDKClient(): Promise<OpencodeClient | null> {
  const status = opencodeManager.getStatus();
  if (!status.running || !status.url) {
    return null;
  }
  
  // Try to read OpenCode auth token from config
  try {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    
    const authPath = path.join(os.homedir(), '.local/share/opencode/auth.json');
    if (fs.existsSync(authPath)) {
      const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      // OpenCode uses the GitHub Copilot token for server auth
      const token = authData['github-copilot']?.access;
      
      if (token) {
        return createOpencodeClient({ 
          baseUrl: status.url,
          auth: () => token
        });
      }
    }
  } catch (error) {
    console.warn('Could not read OpenCode auth:', error);
  }
  
  // Fallback: try without auth
  return createOpencodeClient({ baseUrl: status.url });
}

/**
 * GET /api/chat/sessions
 * List all active chat sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = Array.from(activeSessions.values());
    res.json(sessions);
  } catch (error) {
    console.error('Error listing chat sessions:', error);
    res.status(500).json({ error: 'Failed to list chat sessions' });
  }
});

/**
 * POST /api/chat/sessions
 * Create a new chat session for a PR
 * Body: { prNumber: number, context: string }
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { prNumber, context } = req.body;

    if (!prNumber) {
      return res.status(400).json({ error: 'prNumber is required' });
    }

    const client = await getSDKClient();
    if (!client) {
      return res.status(503).json({ error: 'OpenCode server is not running' });
    }

    // Create session via OpenCode SDK
    const result = await client.session.create({
      body: { title: `PR #${prNumber} Chat` },
    });

    if (!result.data) {
      console.error('Failed to create OpenCode session:', result.error);
      return res.status(500).json({ error: 'Failed to create chat session' });
    }

    const session = result.data;
    const sessionId = session.id;

    // If context provided, send it as initial message (no reply expected)
    if (context) {
      await client.session.prompt({
        path: { id: sessionId },
        body: {
          noReply: true, // Just inject context, don't generate response
          parts: [{ type: 'text', text: context }],
        },
      });
    }

    // Store session metadata
    const chatSession: ChatSession = {
      id: sessionId,
      prNumber,
      title: `PR #${prNumber} Chat`,
      createdAt: Date.now(),
      messageCount: 0,
    };
    activeSessions.set(sessionId, chatSession);

    res.json(chatSession);
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

/**
 * GET /api/chat/sessions/:id
 * Get session details including message history
 */
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    const session = activeSessions.get(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const client = await getSDKClient();
    if (!client) {
      return res.status(503).json({ error: 'OpenCode server is not running' });
    }

    // Fetch messages from OpenCode SDK
    const result = await client.session.messages({ path: { id } });
    
    if (!result.data) {
      console.error('Failed to fetch messages:', result.error);
      return res.status(500).json({ error: 'Failed to fetch session messages' });
    }

    const messages = result.data;

    // Convert to our format
    const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
      role: msg.info.role === 'user' ? 'user' : 'assistant',
      content: msg.parts.map((p: any) => p.text || '').join(''),
      timestamp: msg.info.timestamp || Date.now(),
    }));

    res.json({
      ...session,
      messages: chatMessages,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/**
 * POST /api/chat/sessions/:id/messages
 * Send a message and stream the response via polling
 * Body: { message: string, agent?: string, model?: { providerID: string, modelID: string } }
 */
router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, agent, model } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const session = activeSessions.get(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const client = await getSDKClient();
    if (!client) {
      return res.status(503).json({ error: 'OpenCode server is not running' });
    }

    // Set up SSE (Server-Sent Events) for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

    try {
      // Get current message count using SDK
      const messagesResult = await client.session.messages({ path: { id } });
      const messageCountBefore = messagesResult.data ? messagesResult.data.length : 0;

      console.log(`[Chat] Sending prompt for session ${id}...`);

      // Send message to OpenCode (this blocks until AI responds)
      // Note: OpenCode's prompt() waits for the complete response, so we can't get incremental updates
      const promptResult = await client.session.prompt({
        path: { id },
        body: {
          // Don't specify agent - let OpenCode use the session's default
          model: model || { providerID: 'github-copilot', modelID: 'gpt-4.1' },
          parts: [{ type: 'text', text: message }],
        },
      });

      if (!promptResult.data || !promptResult.data.parts) {
        console.error('[Chat] Prompt failed:', promptResult.error);
        const errorMsg = promptResult.error ? String(promptResult.error) : 'Failed to send message';
        res.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
        res.end();
        return;
      }

      console.log(`[Chat] Received response, sending to client`);

      // Extract the assistant's response
      const assistantMessage = promptResult.data;
      const content = assistantMessage.parts.map((p: any) => p.text || '').join('');
      
      // Send the complete response
      res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);

      console.log(`[Chat] Stream complete (${content.length} chars)`);

      // Update message count
      session.messageCount += 1;
      activeSessions.set(id, session);

      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    } catch (streamError) {
      console.error('Error streaming response:', streamError);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming failed' })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('Error sending message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
});

/**
 * DELETE /api/chat/sessions/:id
 * Delete a chat session
 */
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    const session = activeSessions.get(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const client = await getSDKClient();
    if (client) {
      // Delete session from OpenCode using SDK
      await client.session.delete({ path: { id } });
    }

    // Remove from our store
    activeSessions.delete(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
