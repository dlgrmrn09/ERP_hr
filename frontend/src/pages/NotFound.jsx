import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen  flex flex-col font-sans antialiased text-[#223345]">
      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center justify-center px-6 gap-12">
        {/* Left Side: Text Content */}
        <div className="flex-1 space-y-8 text-center md:text-left">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#223345]">
              Уучлаарай!
            </h1>
            <p className="text-3xl md:text-4xl font-bold text-[#223345] leading-tight">
              Таны хайж буй хуудас <br className="hidden md:block" /> олдсонгүй
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#223345]">
              Боломжит шалтгаанууд
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 justify-center md:justify-start text-gray-600">
                <span className="w-1.5 h-1.5 bg-[#223345] rounded-full"></span>
                Холбоос алдаатай бичигдсэн байх
              </li>
              <li className="flex items-center gap-3 justify-center md:justify-start text-gray-600">
                <span className="w-1.5 h-1.5 bg-[#223345] rounded-full"></span>
                Холбоос идэвхгүй болсон байх .
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
            <Link to="/dashboard">
              <button className="px-8 py-3 bg-[#223345] text-white font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-lg cursor-pointer">
                Нүүр хуудас руу буцах
              </button>
            </Link>
          </div>
        </div>

        {/* Right Side: Illustration */}
        <div className="flex-1 relative w-full max-w-lg">
          {/* Recreating the Green Circle and Illustration Layout */}
          <div className="relative">
            {/* Illustration Asset */}
            <img
              src="https://img.freepik.com/free-vector/404-error-with-tired-person-concept-illustration_114360-7889.jpg"
              alt="404 Illustration"
              className="w-full h-auto mix-blend-multiply opacity-90"
            />

            {/* Decorative elements (floating envelopes/clouds style) */}
            <div className="hidden md:block">
              <div className="absolute top-0 right-10 w-24 h-8 bg-white/40 rounded-full blur-xl"></div>
              <div className="absolute bottom-10 left-0 w-20 h-12 bg-[#223345]/5 rounded-lg rotate-12"></div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Spacer */}
      <footer className="h-20"></footer>
    </div>
  );
};

export default NotFound;
