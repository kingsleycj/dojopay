export interface Task {
    id: number;
    title: string;
    description?: string;
    amount: string;
    status: 'available' | 'completed' | 'pending' | 'paid';
    createdAt: string;
    expiresAt?: string;
    options?: Array<{
        id: number;
        image_url?: string;
        imageUrl?: string;
    }>;
}
