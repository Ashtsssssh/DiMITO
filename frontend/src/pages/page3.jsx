export default function Page3() {
  return (
    <div className="flex-1 overflow-auto bg-zinc-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent">
        Page 3 - Resources
      </h1>
      <div className="space-y-4">
        <div className="bg-zinc-900 rounded-xl p-6 border border-green-800">
          <h3 className="text-xl font-semibold mb-2 text-green-400">Resources</h3>
          <p className="text-gray-400">Access your saved resources and materials</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-teal-800">
          <h3 className="text-xl font-semibold mb-2 text-teal-400">Documentation</h3>
          <p className="text-gray-400">Browse through guides and tutorials</p>
        </div>
      </div>
    </div>
  );
}