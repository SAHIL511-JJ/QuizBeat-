# QuizBeat Landing Page - Agent Brief

> **Give this document to any AI agent to build the QuizBeat landing page.**

---

## 🎯 Mission

Build a **stunning, modern landing page** for QuizBeat using **Next.js 14+** with App Router, TypeScript, and Tailwind CSS.

---

## 📦 Product Context

**QuizBeat** is an AI-powered quiz platform for students.

### Core Features to Highlight:
| Feature | Description |
|---------|-------------|
| 📚 Textbook Upload | Upload PDF, Word, or text files |
| 🧠 AI Quiz Generation | Generates quizzes using Llama 70B AI |
| 📊 Difficulty Levels | Easy, Medium, Hard options |
| 📖 Chapter Selection | Focus quizzes on specific chapters |
| 🎮 Multiplayer Mode | Kahoot-like real-time competitions |
| ✅ Explanations | AI-generated answer explanations |
| 🔐 Google Sign-In | One-click secure authentication |

### Target Audience
- College & university students
- High school students
- Study groups
- Teachers/professors

---

## 🎨 Design Requirements

### Aesthetic
- **Premium, modern, futuristic** look
- Dark mode with vibrant gradients
- Glassmorphism effects
- Smooth micro-animations
- Professional typography

### Color Palette
```
Primary: #6366F1 (Indigo)
Secondary: #EC4899 (Pink)
Background: #0F0F1A (Dark)
Surface: #1A1A2E
Text: #FFFFFF
Muted: #9CA3AF
```

### Must-Have Effects
- Gradient mesh backgrounds
- Hover glow effects
- Scroll-triggered animations
- Parallax elements
- Animated hero section

---

## 📐 Page Sections (In Order)

1. **Hero** - Headline, subheadline, 2 CTAs, animated visual
2. **Social Proof** - Stats bar (users, quizzes generated)
3. **Features** - 6-card grid with icons
4. **How It Works** - 3-step visual flow (Upload → Generate → Compete)
5. **Product Showcase** - Screenshots/mockups of the app
6. **Testimonials** - Student quotes with ratings
7. **FAQ** - Accordion with 4-5 questions
8. **Final CTA** - Email signup + big button
9. **Footer** - Links, social icons, copyright

---

## 🛠️ Technical Specs

### Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Setup Commands
```bash
npx -y create-next-app@latest landing --typescript --tailwind --eslint --app --src-dir=false
cd landing
npm install framer-motion lucide-react
```

### File Structure
```
landing/
├── app/
│   ├── layout.tsx      # Root layout with fonts
│   ├── page.tsx        # Main landing page
│   └── globals.css     # Tailwind + custom styles
├── components/
│   ├── Hero.tsx
│   ├── Features.tsx
│   ├── HowItWorks.tsx
│   ├── Testimonials.tsx
│   ├── FAQ.tsx
│   ├── CTA.tsx
│   └── Footer.tsx
└── public/
    └── images/
```

---

## ✅ Deliverables Checklist

- [ ] Fully responsive (mobile-first)
- [ ] All 9 sections implemented
- [ ] Smooth animations on scroll
- [ ] Interactive hover states
- [ ] Fast load time (< 2s)
- [ ] SEO meta tags configured
- [ ] Accessibility basics (alt tags, semantic HTML)
- [ ] Clean, organized code

---

## 🚫 Avoid

- Generic corporate look
- Static/boring layouts
- Placeholder "Lorem ipsum" text
- Stock photo faces
- Slow animations
- Cluttered designs

---

## 💡 Inspiration Keywords

- SaaS landing pages
- EdTech platforms
- Notion, Linear, Vercel aesthetics
- Glassmorphism UI
- Dark mode excellence

---

## 🎬 Example Content

### Hero Headline Options
- "Turn Any Textbook Into an Interactive Quiz"
- "Study Smarter with AI-Powered Quizzes"
- "Your Textbooks, Transformed Into Games"

### Hero Subheadline
"Upload your study materials, let AI create quizzes, and compete with friends in real-time. Learning has never been this fun."

### CTA Buttons
- Primary: "Get Started Free"
- Secondary: "Watch Demo" or "See How It Works"

---

**Build something amazing! 🚀**
