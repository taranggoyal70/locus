import { ClerkProvider } from "@clerk/nextjs";

export default function ClerkLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      dynamic
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      localization={{
        signIn: { start: { title: "Sign in to Locus" } },
        signUp: { start: { title: "Create your Locus account" } },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
