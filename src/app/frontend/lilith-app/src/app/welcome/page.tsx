'use client';

import { AnimationText } from '@/components/AnimationText';
import { Button } from '@/components/Button';
import { useRouter } from 'next/navigation';
import Link from "next/link";

export default function WelcomePage() {
  const router = useRouter();

  const handleAgree = () => {
    router.push('/style-selection');
  };

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <img
          src="/MaodeLab_Show.svg"
          alt="MaodeLab logo"
          width={100}
          height={100}
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <AnimationText 
            text="嗨！欢迎来到 Lilith WebUI" 
            className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50" 
          />
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            该应用程序由 猫德实验室 设计和开发，旨在为用户提供一个友好且高效的界面，以便更好地管理和使用 Lilith 相关的功能和服务。请仔细阅读{" "}
            <Link
              href="/user-agreement"
              className="font-medium text-zinc-950 dark:text-zinc-50 hover:underline"
            >
              《用户协议》
            </Link>{" "}
            ，并选择同意或取消。
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Button
            variant="primary"
            size="md"
            onClick={handleAgree}
          >
            同意并继续
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={handleCancel}
          >
            取消
          </Button>
        </div>
      </main>
    </div>
  );
}