"use client";

import React, { type FormEvent, useState } from "react";
import { stats, orders ,productsNavItems} from "./DummyData";


export default function Page() {
  const [showSignIn, setShowSignIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignIn = (formdata: FormEvent<HTMLFormElement>) => {
    formdata.preventDefault();
    setMessage("Sign-in UI is ready. Connect your login API to authenticate.");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-6 md:flex md:flex-col">
          <h1 className="mb-10 text-2xl font-extrabold text-blue-600">
            ◈ MyApp
          </h1>

          <nav className="space-y-3">
            {productsNavItems.map(([icon, name], index) => (
              <button
                key={name}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                  index === 0
                    ? "bg-blue-50 font-semibold text-blue-600"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span>{icon}</span>
                {name}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-blue-50 p-4">
            <p className="font-semibold text-blue-800">Welcome aboard!</p>
            <p className="mt-1 text-sm text-slate-500">
              Manage your business in one place.
            </p>
          </div>
        </aside>

        {/* Dashboard */}
        <section className="min-w-0 flex-1">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
            <div>
              <p className="text-sm text-slate-400">MyApp / Overview</p>
              <p className="font-semibold">Dashboard</p>
            </div>

            <button
              onClick={() => {
                setShowSignIn(true);
                setMessage("");
              }}
              className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Sign In →
            </button>
          </header>

          <div className="p-5 sm:p-8">
            <div className="mb-8">
              <p className="text-sm font-medium text-blue-600">
                MONDAY, OCTOBER 19
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Welcome back! 👋
              </h2>
              <p className="mt-2 text-slate-500">
                Here&apos;s what&apos;s happening with your business today.
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      {stat.title}
                    </p>
                    <span className="rounded-xl bg-blue-50 px-3 py-2 text-xl text-blue-600">
                      {stat.icon}
                    </span>
                  </div>
                  <h3 className="mt-5 text-3xl font-bold">{stat.value}</h3>
                  <p className="mt-3 text-sm font-medium text-emerald-600">
                    ↑ {stat.change}{" "}
                    <span className="font-normal text-slate-400">
                      vs last month
                    </span>
                  </p>
                </div>
              ))}
            </div>

            {/* Sales chart */}
            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Sales Overview</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Performance over the last 7 days
                  </p>
                </div>
                <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  Last 7 days⌄
                </span>
              </div>

              <div className="h-52 w-full">
                <svg
                  viewBox="0 0 700 200"
                  preserveAspectRatio="none"
                  className="h-full w-full"
                  role="img"
                  aria-label="Illustrative sales trend chart"
                >
                  {[35, 75, 115, 155].map((y) => (
                    <line
                      key={y}
                      x1="20"
                      y1={y}
                      x2="680"
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="5 5"
                    />
                  ))}
                  <path
                    d="M20 145 L120 115 L220 125 L320 75 L420 95 L520 45 L620 65 L680 20 L680 175 L20 175 Z"
                    fill="#3b82f6"
                    fillOpacity="0.10"
                  />
                  <polyline
                    points="20,145 120,115 220,125 320,75 420,95 520,45 620,65 680,20"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {[
                    [20, 145],
                    [120, 115],
                    [220, 125],
                    [320, 75],
                    [420, 95],
                    [520, 45],
                    [620, 65],
                    [680, 20],
                  ].map(([x, y]) => (
                    <circle key={x} cx={x} cy={y} r="4" fill="#2563eb" />
                  ))}
                </svg>
              </div>

              <div className="mt-3 flex justify-between text-xs text-slate-400">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day) => <span key={day}>{day}</span>
                )}
              </div>
            </div>

            {/* Recent orders */}
            <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between p-6">
                <h3 className="text-lg font-bold">Recent Orders</h3>
                <button className="text-sm font-semibold text-blue-600">
                  View all →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {["Order ID", "Customer", "Status", "Amount"].map(
                        (heading) => (
                          <th key={heading} className="px-6 py-4 font-medium">
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-6 py-4 font-medium">{order.id}</td>
                        <td className="px-6 py-4">{order.customer}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            order.status === "Delivered"
                              ? "bg-emerald-50 text-emerald-700"
                              : order.status === "Processing"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold">
                          {order.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Sign-in modal */}
      {showSignIn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSignIn(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
            <button
              onClick={() => setShowSignIn(false)}
              aria-label="Close sign-in"
              className="absolute right-5 top-5 rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-100"
            >
              ×
            </button>

            <div className="mb-7">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white">
                ◈
              </div>
              <h2 className="text-3xl font-bold">Sign In</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Welcome back! Enter your details to access your account.
              </p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 text-slate-500">
                  <input type="checkbox" className="accent-blue-600" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setMessage("Connect your password-reset flow here.")}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                Sign In →
              </button>

              {message && (
                <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
                  {message}
                </p>
              )}
            </form>

            <p className="mt-7 text-center text-sm text-slate-400">
              Secure access to your dashboard
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
