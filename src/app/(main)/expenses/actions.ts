"use server";

import { getDb } from "@/lib/db";

export async function getExpenses() {
  const pool = await getDb();
  const result = await pool.request().query(`
    SELECT Id, Category, Description, Amount, ExpenseDate
    FROM Expenses
    ORDER BY ExpenseDate DESC
  `);
  return result.recordset;
}

export async function addExpense(exp: {
  category: string;
  description: string;
  amount: string;
  date: string;
}) {
  const pool = await getDb();
  await pool
    .request()
    .input("cat", exp.category)
    .input("desc", exp.description || null)
    .input("amt", Number(exp.amount))
    .input("date", exp.date || new Date())
    .query(
      `INSERT INTO Expenses (Category, Description, Amount, ExpenseDate)
       VALUES (@cat, @desc, @amt, @date)`
    );
}

export async function updateExpense(
  id: string,
  exp: { category: string; description: string; amount: string; date: string }
) {
  const pool = await getDb();
  await pool
    .request()
    .input("id", id)
    .input("cat", exp.category)
    .input("desc", exp.description || null)
    .input("amt", Number(exp.amount))
    .input("date", exp.date || new Date())
    .query(
      `UPDATE Expenses 
       SET Category=@cat, Description=@desc, Amount=@amt, ExpenseDate=@date
       WHERE Id=@id`
    );
}

export async function deleteExpense(id: string) {
  const pool = await getDb();
  await pool.request().input("id", id).query(`DELETE FROM Expenses WHERE Id=@id`);
}
