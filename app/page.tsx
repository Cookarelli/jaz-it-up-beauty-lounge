import { Button, Placeholder } from "@/components/site";
import { ArrowUpRight, Sparkles, Heart, Scissors } from "lucide-react";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">WELCOME TO YOUR NEXT GOOD HAIR DAY</span>
          <h1>
            A little refresh.
            <br />A whole new
            <br />
            <em>feeling.</em>
          </h1>
          <p>
            Beautiful hair. Easy conversation. Time just for you.
            <br />
            Make yourself at home at Jaz It Up Beauty Lounge.
          </p>
          <div className="actions">
            <Button href="/book">Find your next appointment</Button>
            <Button secondary href="/services">
              Explore services
            </Button>
          </div>
          <div className="hero-note">
            <span>✧</span> Thoughtful care, from consultation to finishing
            touch.
          </div>
        </div>
        <div className="hero-art">
          <div className="arch">
            <Placeholder label="Your next chapter starts here" />
          </div>
          <div className="art-caption">
            COME AS YOU ARE.
            <br />
            <i>Leave feeling like you.</i>
          </div>
          <span className="art-star">✳</span>
        </div>
      </section>
      <div className="ribbon">
        GOOD HAIR · GOOD COMPANY · A LITTLE CONFIDENCE · JAZ IT UP · GOOD HAIR ·
        GOOD COMPANY
      </div>
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE MENU</span>
            <h2>Your hair. Your kind of beautiful.</h2>
          </div>
          <Button secondary href="/services">
            All services
          </Button>
        </div>
        <div className="cards">
          {[
            [
              Scissors,
              "Cut & finish",
              "Fresh shape. Effortless movement. A finish that feels like you.",
            ],
            [
              Sparkles,
              "Color & dimension",
              "A soft change or a bold new chapter. Let’s find your shade.",
            ],
            [
              Heart,
              "Styling & occasions",
              "A little extra care for your everyday and your big days.",
            ],
          ].map(([Icon, title, copy]) => {
            const I = Icon as typeof Scissors;
            return (
              <a href="/services" className="card" key={String(title)}>
                <I size={28} strokeWidth={1.3} />
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
                <ArrowUpRight size={20} />
              </a>
            );
          })}
        </div>
        <small className="muted">
          Service categories are illustrative until Delia publishes the salon
          menu.
        </small>
      </section>
      <section className="about">
        <div>
          <span className="eyebrow">A PERSONAL TOUCH</span>
          <h2>
            More than a chair.
            <br />
            <em>A place to feel good.</em>
          </h2>
        </div>
        <div>
          <p>
            Welcome to Delia’s Jaz It Up Beauty Lounge. A warm space for fresh
            looks, personal attention, and a well-deserved moment to yourself.
          </p>
          <p>
            Whether you know exactly what you want or need a little inspiration,
            your visit starts with a conversation.
          </p>
          <Button secondary href="/book">
            Let’s make time for you
          </Button>
        </div>
      </section>
      <section className="cta">
        <span className="eyebrow">YOUR CHAIR IS WAITING</span>
        <h2>
          Ready for a little <em>Jaz?</em>
        </h2>
        <Button href="/book">Book your visit</Button>
      </section>
    </>
  );
}
