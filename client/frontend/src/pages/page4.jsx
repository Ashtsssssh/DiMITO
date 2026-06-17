export default function Page4() {
  return (
    <div className="flex-1 overflow-auto bg-zinc-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
        Page 4 - Notifications
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 rounded-xl p-6 border border-orange-800">
          <h3 className="text-lg font-semibold mb-2 text-orange-400">Notifications</h3>
          <p className="text-sm text-gray-400">Stay updated</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-red-800">
          <h3 className="text-lg font-semibold mb-2 text-red-400">Messages</h3>
          <p className="text-sm text-gray-400">Check inbox</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-6 border border-pink-800">
          <h3 className="text-lg font-semibold mb-2 text-pink-400">Updates</h3>
          <p className="text-sm text-gray-400">Latest news</p>
        </div>
      </div>
    </div>
  );
}