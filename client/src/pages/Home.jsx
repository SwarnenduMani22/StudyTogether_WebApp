import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ================= Hero Section ================= */}

      <section className="max-w-6xl mx-auto px-6 py-24 text-center fade-in">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white">
          StudyTogether
        </h1>

        <p className="mt-6 text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
          Share and access study materials easily. Discover notes, question
          papers and resources uploaded by your classmates.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/papers"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg transition shadow-md"
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

      {/* ================= Features Section ================= */}

      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white">
          Platform Features
        </h2>

        <div className="grid md:grid-cols-3 gap-8 mt-12">
          <div className="card hover-lift text-center">
            <div className="text-4xl">📤</div>

            <h3 className="text-xl font-semibold mt-4">Upload Papers</h3>

            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Admins can upload study materials and resources for students.
            </p>
          </div>

          <div className="card hover-lift text-center">
            <div className="text-4xl">🔎</div>

            <h3 className="text-xl font-semibold mt-4">Search & Filter</h3>

            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Quickly find papers by title, subject or semester.
            </p>
          </div>

          <div className="card hover-lift text-center">
            <div className="text-4xl">📄</div>

            <h3 className="text-xl font-semibold mt-4">Preview & Download</h3>

            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Preview PDF files instantly and download when needed.
            </p>
          </div>
        </div>
      </section>

      {/* ================= CTA Section ================= */}

      <section className="text-center py-20 bg-indigo-600">
        <h2 className="text-3xl font-bold text-white">
          Start Studying Smarter
        </h2>

        <p className="mt-4 text-indigo-100 max-w-xl mx-auto">
          Join StudyTogether today and access shared notes and question papers
          instantly.
        </p>

        <Link
          to="/register"
          className="inline-block mt-8 bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition shadow-md"
        >
          Create Account
        </Link>
      </section>
    </div>
  );
};

export default Home;
