export default function Page2() {
  return (
    <div className="flex-1 overflow-auto bg-zinc-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        Page 2 - Analytics
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl p-6 border border-blue-800">
          <h3 className="text-xl font-semibold mb-2 text-blue-400">Performance Metrics</h3>
          <p className="text-gray-400">View your performance metrics and insights</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-purple-800">
          <h3 className="text-xl font-semibold mb-2 text-purple-400">Reports</h3>
          <p className="text-gray-400">Generate detailed reports and summaries</p>
        </div>
      </div>
    </div>
  );
}