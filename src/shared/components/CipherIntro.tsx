export function CipherIntro({ title, description }: { title: string; description: string }) {
  return (
    <header className="cipher-intro">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}
