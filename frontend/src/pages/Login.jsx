import { useState } from "react";

function Login() {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  return (
    <div className="min-h-screen  flex items-center justify-center px-4 py-12 font-['Roboto',sans-serif]">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 sm:p-10">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Хүний Нөөц
          </h1>
        </div>

        <form className="mt-10 space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Имэйл хаяг
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Нууц үг
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-12 text-gray-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-3 flex items-center justify-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.73 10.73a2 2 0 002.83 2.83" />
                    <path d="M9.88 5.09A9.09 9.09 0 0112 4c5 0 9 4 9 8 0 1.08-.27 2.1-.76 3.02m-3.4 3.78A8.94 8.94 0 0112 20c-5 0-9-4-9-8 0-1.64.5-3.18 1.36-4.5" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            Нэвтрэх
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
