import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';
import { Glow } from '@/components/landing/decor';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/studio');
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-5 py-12">
      <Glow className="left-1/2 top-[-160px] h-[440px] w-[640px] -translate-x-1/2" />
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
