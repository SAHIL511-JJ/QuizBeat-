const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function createMcpLoginCode(user) {
    if (!user) {
        throw new Error('You must be logged in to generate an MCP login code.');
    }

    const idToken = await user.getIdToken();

    const response = await fetch(`${API_URL}/api/mcp/auth/create-login-code`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${idToken}`,
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const detail = data?.detail;
        if (detail?.message) {
            throw new Error(detail.message);
        }
        throw new Error('Failed to generate MCP login code.');
    }

    return data;
}
