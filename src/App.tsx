function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 max-w-sm w-full">
        <h1 className="text-3xl font-bold text-purple-700 tracking-tight">LIFE-APP</h1>
        <p className="text-gray-500 text-center text-sm">
          Powered by the Pi Network ecosystem
        </p>
        <button
          className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors duration-200"
          onClick={() => alert('Pi Wallet connection coming soon!')}
        >
          Connect Pi Wallet
        </button>
      </div>
    </div>
  )
}

export default App
