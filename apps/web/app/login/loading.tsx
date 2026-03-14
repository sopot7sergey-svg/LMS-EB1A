export default function LoginLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: '#0a0a0f', color: '#a1a1aa' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: '#635BFF', borderTopColor: 'transparent' }}
        />
        <span>Loading...</span>
      </div>
    </div>
  );
}
