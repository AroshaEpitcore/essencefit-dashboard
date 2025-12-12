import { getDb } from "@/lib/db";

export default async function TestDbPage() {
  try {
    const db = await getDb();
    const result = await db.request().query("SELECT GETDATE() AS now");

    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-green-600">✅ Database Connected</h1>
        <p>Server Time: {result.recordset[0].now.toString()}</p>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="p-6 text-red-600">
        <h1 className="text-xl font-bold">❌ Database Error</h1>
        <pre>{err.message}</pre>
      </div>
    );
  }
}
