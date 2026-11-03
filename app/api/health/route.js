import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export const GET = () => Response.json({ ok: true, db: mongoose.connection.readyState === 1 });
