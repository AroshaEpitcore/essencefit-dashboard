"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { LogIn, Lock, User } from "lucide-react";
import { loginUser } from "./actions";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      const user = await loginUser(username, password);
      toast.success(`Welcome back, ${user.Username}!`);
      localStorage.setItem("authUser", JSON.stringify(user));
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center  text-white px-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-xl bg-gray-900/80 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center space-x-2 text-primary text-4xl font-bold">
            <LogIn className="w-8 h-8 text-primary" />
            <span>EssenceFit</span>
          </div>
          <p className="text-gray-400 text-sm mt-2">Inventory + Finance System </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="w-5 h-5 text-gray-400" />
            </div>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="w-5 h-5 text-gray-400" />
            </div>
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              required
            />
          </div>

          <button type="submit" className="w-full bg-primary hover:bg-primary/90 transition-colors px-4 py-3 rounded-lg font-semibold shadow-lg mt-6">
            Sign In
          </button>
        </form>

        <p className="mt-6 text-sm text-center text-gray-400">
          Don't have an account? <a href="/register" className="text-primary hover:underline">Register</a>
        </p>
      </div>
    </div>
  );
}