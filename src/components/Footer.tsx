export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-600 text-white mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center">
        <h3 className="text-lg sm:text-xl font-bold mb-1.5">চিরকুমার সংঘ বাংলাদেশ</h3>
        <p className="text-sm text-white/90 mb-3">ডিজাইনারঃ মোঃ নাজমুল সেখ</p>
        <p className="text-xs sm:text-sm text-white/80">
          © {year} চিরকুমার সংঘ বাংলাদেশ। সর্বাধিকার সংরক্ষিত।
        </p>
      </div>
    </footer>
  );
}
