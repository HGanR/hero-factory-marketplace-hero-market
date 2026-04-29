import Link from "next/link";

export default function RosAccessDeniedPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Revenue OS isn’t enabled for your account</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          You’re signed in, but an administrator has turned off Revenue OS access for this user. Ask your admin to enable
          “ROS access” in the admin panel if you need the product.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-400 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/80 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
