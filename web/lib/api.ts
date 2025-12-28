const API_BASE_URL = 'http://localhost:8000';

// API helper function
async function apiRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
    }

    return response.json();
}

// Auth
export const authApi = {
    getCurrentUser: () => apiRequest('/me'),
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
    getGoogleLoginUrl: () => `${API_BASE_URL}/login`,
};

// Conversations
export const conversationsApi = {
    getAll: () => apiRequest('/api/conversations'),
    create: (title = 'New Chat') => apiRequest('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ title }),
    }),
    delete: (id: number) => apiRequest(`/api/conversations/${id}`, { method: 'DELETE' }),
};

// Messages
export const messagesApi = {
    getByConversation: (conversationId: number) =>
        apiRequest(`/api/conversations/${conversationId}/messages`),
};

// Chat
export const chatApi = {
    sendMessage: (message: string, conversationId?: number) =>
        apiRequest('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ message, conversation_id: conversationId }),
        }),
    streamChat: async (message: string, conversationId?: number) => {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, conversation_id: conversationId }),
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Not authenticated. Please login first.');
            }
            const error = await response.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(error.detail || 'Request failed');
        }

        return response;
    },
};
