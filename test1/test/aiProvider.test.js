import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChatCompletion } from '../services/aiProvider.js';

test('streams assistant deltas and captures final token usage', async (context) => {
    const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":" there"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
        'data: [DONE]\n\n',
    ];
    context.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
            controller.close();
        },
    }), { headers: { 'content-type': 'text/event-stream' } }));

    const deltas = [];
    const result = await generateChatCompletion({ messages: [{ role: 'user', content: 'Hi' }], onDelta: (text) => deltas.push(text) });
    assert.equal(result.content, 'Hello there');
    assert.deepEqual(deltas, ['Hello', ' there']);
    assert.deepEqual(result.usage, { promptTokens: 5, completionTokens: 2, totalTokens: 7 });
});

test('maps provider HTTP errors to a safe API error', async (context) => {
    context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { message: 'private provider detail' } }), { status: 401 }));
    await assert.rejects(
        generateChatCompletion({ messages: [{ role: 'user', content: 'Hi' }] }),
        (error) => error.statusCode === 502 && error.message.includes('could not complete') && !error.message.includes('private provider detail'),
    );
});
