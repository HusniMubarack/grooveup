import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-serif text-4xl text-primary">404</p>
      <p className="mt-2 text-muted-foreground">This floor is empty.</p>
      <Link href="/explore" className="mt-4 inline-block text-primary underline">Back to Explore</Link>
    </div>
  );
}
