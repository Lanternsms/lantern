import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { RegisterDemo } from '@/components/landing/register-demo'

export const metadata: Metadata = {
  title: 'Lantern — your whole school, in one place',
  description:
    'Attendance, results and fees for Nigerian secondary schools. Every parent hears what happened the minute it does.',
}

const PCT = [
  [97, 94, 100, 92, 97, 94],
  [94, 88, 97, 94, 100, 97],
  [97, null, 94, 97, 85, 94],
  [null, 94, 97, 97, 91, 94],
  [94, null, 97, 100, 94, 97],
  [97, 94, 89, 94, 97, 90],
]
const LEVELS = ['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3']

const FAQ = [
  { q: 'Do parents need to install an app?', a: 'No. Lantern opens in the phone’s browser and can be added to the home screen. Alerts arrive as notifications or email.' },
  { q: 'What about our existing records?', a: 'Send a spreadsheet of students, guardians and classes. We import it with you and you check it before your first day.' },
  { q: 'Can it use our school’s colours and crest?', a: 'Yes. Staff, students and parents all see your colour and crest on every screen.' },
  { q: 'Who can change a result after approval?', a: 'Only the principal can reopen a published result, and every change is kept in the audit log.' },
  { q: 'What if our internet is slow?', a: 'Pages are light, and attendance still works offline — it saves when the connection comes back.' },
]

const h2 = 'text-[clamp(30px,3.4vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]'
const panel = 'rounded-2xl border border-[#e7e7e7] bg-white'


export default function Home() {
  return (
    <div className="bg-[#fafafa] text-[17px] leading-relaxed text-[#182350]">
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-[#fafafa]/90 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-6 px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]">
            <Image src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8" priority />
            Lantern
          </Link>
          <nav aria-label="Main" className="hidden flex-1 gap-6 text-[15px] text-[#3d434d] md:flex">
            <a href="#product" className="hover:text-[#182350]">Product</a>
            <a href="#faq" className="hover:text-[#182350]">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/login" className="text-[15px] text-[#3d434d] hover:text-[#182350]">Sign in</Link>
            <a href="/book-demo" className="press flex h-10 items-center rounded-lg bg-[#182350] px-4 text-[15px] font-semibold text-white">
              Book a demo
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 px-5 pb-14 pt-10 sm:gap-14 sm:px-6 sm:pb-22 sm:pt-18">
          <div className="flex min-w-0 flex-[1_1_500px] flex-col gap-6">
            <h1 className="text-[clamp(40px,4.4vw,58px)] font-bold leading-[1.04] tracking-[-0.03em] text-balance">
              Your whole school, in one place.
            </h1>
            <p className="max-w-[34ch] text-xl text-[#3d434d]">
              Attendance, results and fees for Nigerian secondary schools — and every parent hears what happened
              the minute it does.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="/book-demo" className="press flex h-[50px] items-center rounded-[10px] bg-[#182350] px-5.5 font-semibold text-white">
                Book a free demo
              </a>
              <a href="#product" className="press flex h-[50px] items-center rounded-[10px] border border-[#d4d4d4] bg-white px-5 font-medium">
                See how it works
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-[#3d434d]">
              {['Free 30-minute demo', 'Live in a week', 'No app download for parents'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#182350" /><path d="m7.5 12.2 3 3 6-6.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 flex-[1_1_520px]">
            <RegisterDemo />
          </div>
        </section>

        <section aria-label="What Lantern covers" className="border-y border-[#e7e7e7] bg-white">
          <ul className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-3 px-5 py-5.5 text-[15px] text-[#3d434d] sm:grid-cols-3 sm:px-6 xl:grid-cols-6">
            <li><strong className="text-[#182350]">Attendance</strong> by 8am</li>
            <li><strong className="text-[#182350]">Results</strong> with approval</li>
            <li><strong className="text-[#182350]">Report cards</strong> in one click</li>
            <li><strong className="text-[#182350]">Fees</strong> and receipts</li>
            <li><strong className="text-[#182350]">Parents</strong> told instantly</li>
            <li><strong className="text-[#182350]">Your</strong> colours and crest</li>
          </ul>
        </section>

        <section id="product" className="mx-auto flex max-w-[1200px] flex-col gap-16 px-5 pb-10 pt-16 sm:gap-28 sm:px-6 sm:pt-28">
          <div className="flex flex-wrap items-center gap-8 sm:gap-14">
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
              <h2 className={h2}>The whole morning at a glance.</h2>
              <p className="max-w-[44ch] text-[#3d434d]">
                Every class’s attendance on one board, the ones still to mark shown plainly, fees received this week, and
                the result batches waiting for a signature.
              </p>
            </div>
            <div data-ui className={`${panel} flex min-w-0 flex-[1_1_560px] flex-col gap-3.5 p-5`}>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">Attendance this morning</span>
                <span className="text-sm font-medium text-[#92400e]">3 still open at 9:40am</span>
              </div>
              <div className="grid grid-cols-[48px_repeat(6,minmax(0,1fr))] items-center gap-1.5 text-[13px] tabular-nums sm:grid-cols-[56px_repeat(6,minmax(0,1fr))]">
                {PCT.map((row, r) => [
                  <span key={`l${r}`} className="font-semibold">{LEVELS[r]}</span>,
                  ...row.map((p, c) =>
                    p === null ? (
                      <span key={`${r}${c}`} className="flex h-[34px] items-center justify-center rounded-md border border-dashed border-[#a3a7ae] text-[#5c626c]">Open</span>
                    ) : (
                      <span key={`${r}${c}`} className={`flex h-[34px] items-center justify-center rounded-md font-medium ${p < 90 ? 'bg-[#1d4ed8] text-white' : 'bg-[#dbe3fd] text-[#1e3a8a]'}`}>
                        {p}%
                      </span>
                    ),
                  ),
                ])}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap-reverse items-center gap-8 sm:gap-14">
            <div data-ui className={`${panel} flex min-w-0 flex-[1_1_560px] flex-col gap-3.5 p-5`}>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">Mathematics · JSS 2B</span>
                <span className="rounded-full bg-[#fffbeb] px-2 py-0.5 text-[13px] font-medium text-[#92400e]">With head of maths</span>
              </div>
              <ol className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
                <li className="rounded-lg bg-[#eef2ff] p-2.5 text-[#1e3a8a]"><strong className="block text-sm">Submitted</strong>Mr. Bello · Mon</li>
                <li className="rounded-lg border border-[#1d4ed8] p-2.5"><strong className="block text-sm">Checking</strong>Mrs. Hassan</li>
                <li className="rounded-lg border border-dashed border-[#c4c4c4] p-2.5 text-[#5c626c]"><strong className="block text-sm">Approve</strong>Principal</li>
                <li className="rounded-lg border border-dashed border-[#c4c4c4] p-2.5 text-[#5c626c]"><strong className="block text-sm">Publish</strong>To guardians</li>
              </ol>
              <div className="grid grid-cols-[1fr_repeat(3,56px)] gap-x-3 gap-y-1.5 text-sm tabular-nums">
                <span className="text-[#5c626c]">Student</span><span className="text-right text-[#5c626c]">CA</span><span className="text-right text-[#5c626c]">Exam</span><span className="text-right text-[#5c626c]">Grade</span>
                <span>Blessing Udo</span><span className="text-right">37</span><span className="text-right">55</span><span className="text-right font-semibold">A1</span>
                <span>Femi Lawal</span><span className="text-right">31</span><span className="text-right">44</span><span className="text-right font-semibold">A1</span>
                <span>Hassan Yusuf</span><span className="text-right">19</span><span className="text-right">29</span><span className="text-right font-semibold">D7</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
              <h2 className={h2}>Results approved before release.</h2>
              <p className="max-w-[44ch] text-[#3d434d]">
                Teachers enter scores; totals, grades and positions work themselves out. The head of department checks, the
                principal approves, and only then do report cards reach parents — all at once.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8 sm:gap-14">
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
              <h2 className={h2}>Fees in, receipts out.</h2>
              <p className="max-w-[44ch] text-[#3d434d]">
                The bursar records a transfer, POS or cash payment; the guardian gets a receipt and sees the balance. You see
                who owes, by class, without a spreadsheet.
              </p>
            </div>
            <div data-ui className="flex min-w-0 flex-[1_1_560px] flex-wrap gap-4">
              <div className={`${panel} flex flex-[1_1_260px] flex-col gap-1.5 p-5`}>
                <span className="text-sm text-[#5c626c]">Collected this term</span>
                <span className="text-[34px] font-bold tracking-[-0.02em] tabular-nums">₦18.42m</span>
                <span className="text-sm text-[#5c626c]">68% of ₦27.10m billed</span>
                <span className="mt-2 block h-2 overflow-hidden rounded bg-[#e8edfb]"><span className="block h-full w-[68%] bg-[#1d4ed8]" /></span>
              </div>
              <div className={`${panel} flex flex-[1_1_240px] flex-col gap-1 p-5 text-sm tabular-nums`}>
                <span className="text-[#5c626c]">Receipt GFC-2026-0412</span>
                <span className="text-lg font-semibold">Chidera Nwosu · JSS 1A</span>
                <span className="mt-2 flex justify-between"><span>First term tuition</span><span>₦85,000</span></span>
                <span className="flex justify-between text-[#5c626c]"><span>Bank transfer · 27 Oct</span><span>Balance ₦0</span></span>
              </div>
            </div>
          </div>
        </section>


        <section aria-label="Book a demo" className="mx-auto max-w-[1200px] px-5 pb-12 pt-4 sm:px-6 sm:pb-16">
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-[#182350] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <p className="max-w-[40ch] text-[19px] font-semibold leading-snug sm:text-[22px]">See your own classes in Lantern, set up while you watch.</p>
            <Link href="/book-demo" className="press flex h-12 w-full shrink-0 items-center justify-center rounded-[10px] bg-white px-6 font-semibold text-[#182350] sm:w-auto">Book a free demo</Link>
          </div>
        </section>

        <section aria-label="Classrooms" className="mx-auto grid max-w-[1200px] grid-cols-2 gap-2 px-5 sm:grid-cols-3 sm:gap-3 sm:px-6">
          <Image src="/landing/library-study.jpg" alt="A student working on his laptop in a bright, modern school library" width={1920} height={1280} sizes="(min-width: 640px) 33vw, 50vw" className="col-span-2 h-[220px] w-full rounded-2xl object-cover sm:col-span-1 sm:h-[360px]" />
          <Image src="/landing/teacher-laptops.jpg" alt="A teacher guiding students working on laptops in a modern classroom" width={1920} height={1280} sizes="(min-width: 640px) 33vw, 50vw" className="h-[150px] w-full rounded-2xl object-cover sm:h-[360px]" />
          <Image src="/landing/pupils-laptop.jpg" alt="Two pupils sharing a laptop on the school stairs" width={1920} height={1280} sizes="(min-width: 640px) 33vw, 50vw" className="h-[150px] w-full rounded-2xl object-cover sm:h-[360px]" />
        </section>

        <section className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-16 sm:gap-10 sm:px-6 sm:py-28">
          <h2 className={`${h2} max-w-[18ch]`}>Live in a week.</h2>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-8">
            {[
              ['Day 1–2', 'Send us your class lists', 'A spreadsheet is fine. We import students, guardians and classes, and you check them.'],
              ['Day 3–4', 'Set your school’s rules', 'Terms, grading scale, CA weighting, fee structures, who approves results — and your colours.'],
              ['Day 5', 'Invite staff and parents', 'Everyone gets an invite by email or SMS, and teachers start taking attendance the same day.'],
            ].map(([when, title, body]) => (
              <li key={title} className="flex flex-col gap-2 border-t border-[#d4d4d4] pt-4.5">
                <span className="text-[15px] text-[#5c626c]">{when}</span>
                <strong className="text-xl">{title}</strong>
                <span className="text-[#3d434d]">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-x-16 gap-y-8 px-5 py-16 sm:gap-y-10 sm:px-6 sm:py-26">
          <h2 className={`${h2} col-span-full`}>Questions schools ask</h2>
          {FAQ.map((f) => (
            <div key={f.q} className="flex flex-col gap-2">
              <h3 className="text-[19px] font-semibold">{f.q}</h3>
              <p className="text-[#3d434d]">{f.a}</p>
            </div>
          ))}
        </section>

        <section id="demo" className="mx-auto mb-16 sm:mb-26 max-w-[1200px] px-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-8 rounded-[20px] border border-[#e2e5ee] bg-white px-7 py-12 text-[#182350] sm:px-10 sm:py-14">
            <div className="flex max-w-[560px] flex-col gap-2.5">
              <h2 className={h2}>See it with your own data.</h2>
              <p className="text-[#5c626c]">A 30-minute call. Bring a class list and we’ll set it up while you watch.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/book-demo" className="press flex h-[52px] items-center rounded-[10px] bg-[#182350] px-6 font-bold text-white">Book a demo</Link>
              <a href="mailto:hello@lantern.ng?subject=Lantern%20demo" className="press flex h-[52px] items-center rounded-[10px] border border-[#d5d9e3] px-5.5 font-medium text-[#182350] hover:border-[#182350]">Email us</a>
            </div>
          </div>
        </section>
      </main>

      {/* Phones: the next step is always one thumb away. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e7e7e7] bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
        <Link href="/book-demo" className="press flex h-12 items-center justify-center rounded-[10px] bg-[#182350] font-semibold text-white">Book a free demo</Link>
      </div>

      <footer className="border-t border-[#e7e7e7] pb-20 sm:pb-0">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-x-12 gap-y-6 px-5 py-10 text-[15px] text-[#5c626c] sm:px-6">
          <span className="flex flex-col gap-1"><strong className="text-[#182350]">Lantern</strong>Lagos, Nigeria</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <a href="#product" className="hover:text-[#182350]">Product</a>
            <Link href="/login" className="hover:text-[#182350]">Sign in</Link>
            <Link href="/privacy" className="hover:text-[#182350]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#182350]">Terms</Link>
          </nav>
          <p className="basis-full text-[13px]">
            Photos: Pexels (free to use).
          </p>
        </div>
      </footer>
    </div>
  )
}
