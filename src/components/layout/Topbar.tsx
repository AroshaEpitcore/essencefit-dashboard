"use client";

import { Moon, Sun, LogOut, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  Id: string;
  Username: string;
  Email: string;
  Role: string;
};

export default function Topbar({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [time, setTime] = useState<string>(""); // ⏰ clock
  const [day, setDay] = useState<string>("");   // 📅 day
  const router = useRouter();

  // Load user
  useEffect(() => {
    const stored = localStorage.getItem("authUser");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  // Update time and day every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDay(
        now.toLocaleDateString([], {
          weekday: "long",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dark mode handler
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  function handleLogout() {
    localStorage.removeItem("authUser");
    router.push("/");
  }

  return (
    <header className="h-14 flex items-center justify-between bg-white/70 dark:bg-gray-900/70 backdrop-blur border-b px-4">
      {/* Left: Sidebar + Brand */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          EssenceFit
        </h1>
      </div>

      {/* Middle: Marquee Announcement */}
      <div className="flex-1 mx-4 overflow-hidden">
        <div className="whitespace-nowrap animate-marquee text-sm text-gray-700 dark:text-gray-300">
          ⚡ Welcome to EssenceFit! Manage all your inventory and finances with ease. Check out the latest updates and reports.
        </div>
      </div>

      {/* Right: Clock + User + Dark Mode + Logout */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-4">
            {/* Clock + Day */}
            <div className="flex flex-col items-center text-gray-600 dark:text-gray-300 leading-tight">
              <span className="text-sm font-mono">{time}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{day}</span>
            </div>

            {/* User info */}
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {user.Username}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user.Role}</p>
            </div>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* Marquee animation */}
      <style jsx>{`
        .animate-marquee {
          display: inline-block;
          padding-left: 100%;
          animation: marquee 30s linear infinite;
        }
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </header>
  );
}
