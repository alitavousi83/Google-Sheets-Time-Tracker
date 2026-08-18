export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background-dark">
      <div className="text-center animate-fade-in">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-2xl">⏱️</span>
        </div>
        <p className="text-sm text-muted font-medium">Loading Premium Time Tracker...</p>
      </div>
    </div>
  );
}
