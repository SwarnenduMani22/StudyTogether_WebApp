import { Link } from "react-router-dom";
import TrendingPapers from "../components/papers/TrendingPapers";

const Home = () => {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ================= HERO SECTION ================= */}

      <section className="max-w-6xl mx-auto px-6 py-28 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-800 dark:text-white leading-tight">
          StudyTogether
        </h1>

        <p className="mt-6 text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
          Share and access study materials easily. Discover notes, previous year
          papers and academic resources uploaded by your classmates.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/papers"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg transition shadow-lg"
          >
            Browse Papers
          </Link>

          <Link
            to="/register"
            className="border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white px-8 py-3 rounded-lg transition"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* ================= TRENDING PAPERS ================= */}

      <TrendingPapers />

      {/* ================= FEATURES ================= */}

      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white">
          Platform Features
        </h2>

        <p className="text-center text-gray-500 mt-4">
          Everything you need to manage and share study resources.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mt-12">
          {/* Feature 1 */}

          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md hover:shadow-xl transition text-center">
            <div className="text-4xl">📤</div>

            <h3 className="text-xl font-semibold mt-4">Upload Papers</h3>

            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Admins can upload study materials and question papers for students
              to access easily.
            </p>
          </div>

          {/* Feature 2 */}

          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md hover:shadow-xl transition text-center">
            <div className="text-4xl">🔎</div>

            <h3 className="text-xl font-semibold mt-4">Smart Search</h3>

            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Find papers quickly using search, subject filter and semester
              filtering system.
            </p>
          </div>

          {/* Feature 3 */}

          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md hover:shadow-xl transition text-center">
            <div className="text-4xl">📄</div>

            <h3 className="text-xl font-semibold mt-4">Preview & Download</h3>

            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Preview PDF files directly in the browser and download them
              whenever needed.
            </p>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}

      <section className="bg-gray-100 dark:bg-gray-800 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white">
            How It Works
          </h2>

          <div className="grid md:grid-cols-3 gap-10 mt-12 text-center">
            <div>
              <div className="text-4xl mb-4">1️⃣</div>

              <h3 className="font-semibold text-lg">Create an Account</h3>

              <p className="text-gray-500 mt-2">
                Register to access the platform and start browsing papers.
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">2️⃣</div>

              <h3 className="font-semibold text-lg">Browse Papers</h3>

              <p className="text-gray-500 mt-2">
                Search and filter papers by subject or semester.
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">3️⃣</div>

              <h3 className="font-semibold text-lg">Download Resources</h3>

              <p className="text-gray-500 mt-2">
                Preview and download study materials instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CALL TO ACTION ================= */}

      <section className="text-center py-24 bg-indigo-600">
        <h2 className="text-3xl font-bold text-white">
          Start Studying Smarter
        </h2>

        <p className="mt-4 text-indigo-100 max-w-xl mx-auto">
          Join StudyTogether today and access shared notes, study materials and
          previous year question papers.
        </p>

        <Link
          to="/register"
          className="inline-block mt-8 bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition shadow-lg"
        >
          Create Account
        </Link>
      </section>
    </main>
  );
};

export default Home;
