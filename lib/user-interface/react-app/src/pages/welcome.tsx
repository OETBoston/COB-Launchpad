import {
  ContentLayout,
  Header,
  Container,
  SpaceBetween,
  Cards,
  Link,
  BreadcrumbGroup,
} from "@cloudscape-design/components";
import BaseAppLayout from "../components/base-app-layout";
import RouterButton from "../components/wrappers/router-button";
import useOnFollow from "../common/hooks/use-on-follow";
import { CHATBOT_NAME } from "../common/constants";
import { useEffect, useState } from "react";

// Custom hook for media query
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 688px)");
    setIsMobile(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return isMobile;
};

export default function Welcome() {
  const onFollow = useOnFollow();
  const isMobile = useIsMobile();

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              data-locator="welcome-header"
              description="This internal AI chatbot is designed to provide City of Boston employees with quick access to resources and support. This is an internal tool for the City of Boston. Data is collected to better understand and expand GenAI use cases."
              actions={
                <RouterButton
                  iconAlign="right"
                  iconName="contact"
                  variant="primary"
                  href="/chatbot/playground"
                >
                  Get Started
                </RouterButton>
              }
            >
              Empowering Boston City Employees: AI-Driven Information and Support
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Header
              variant="h2"
            >
              Featured Applications
            </Header>
            <Cards
              cardDefinition={{
                header: (item) => (
                  <Link
                    external={item.external}
                    href={item.href}
                    fontSize="heading-m"
                  >
                    {item.name}
                  </Link>
                ),
                sections: [
                  {
                    content: (item) => (
                      <div>
                        <img
                          src={item.img}
                          style={{ height: "50px" }}
                        />
                      </div>
                    ),
                  },
                  {
                    content: (item) => (
                      <div>
                        <div>{item.description}</div>
                      </div>
                    ),
                  }
                ],
              }}
              cardsPerRow={[{ cards: 2 }, { minWidth: 700, cards: 3 }]}
              items={[
                {
                  name: "Email Writer",
                  img: "/images/welcome/featured-apps-2/email_writer.png",
                  external: false,
                  href: "/application/b98e6211-409e-47ed-9bde-50bfa9c2335a",
                  description:
                    "Refine your emails to be clearer and more professional",
                },
                {
                  name: "Language Translator",
                  external: false,
                  img: "/images/welcome/featured-apps-2/language_translator.png",
                  href: "/application/0489df6f-9756-4a07-9880-50413331592f",
                  description:
                    "Expertly translate and understand other languages",
                },
                {
                  name: "Agenda Planner",
                  external: false,
                  img: "/images/welcome/featured-apps-2/agenda_planner.png",
                  href: "/application/271a8f9e-b8e0-44f9-a08e-433cd27316c3",
                  description:
                    "Create clear meeting agendas for your team",
                },
                {
                  name: "Policy Consultant",
                  img: "/images/welcome/featured-apps-2/policy_consultant.png",
                  external: false,
                  href: "/application/8a535c99-8ea5-4c90-adfd-e896a49e7c96",
                  description:
                    "Explore, interpret, and summarize Massachusetts government policies",
                },
                {
                  name: "Summary Writer",
                  external: false,
                  img: "/images/welcome/featured-apps-2/summary_writer.png",
                  href: "/application/7b6d9d14-a2d4-4f04-84ec-263a357ae9db",
                  description:
                    "Create concise summaries",
                },
                {
                  name: "Document Summarizer",
                  external: false,
                  img: "/images/welcome/featured-apps-2/document_summarizer.png",
                  href: "/application/d246b11d-1b58-4c2f-8e16-eb8d7c9231a2",
                  description:
                    "Align content to your style brand",
                },
                {
                  name: "Daily Planner",
                  external: false,
                  img: "/images/welcome/featured-apps-2/daily_planner.png",
                  href: "/application/64d17c21-784f-4aa2-a000-40df34d8f768",
                  description:
                    "Organize your day around your goals",
                },
                {
                  name: "Memo Writer",
                  img: "/images/welcome/featured-apps-2/memo_writer.png",
                  external: false,
                  href: "/application/047d3da0-efcf-421e-bc83-d2ccb2802c82",
                  description:
                    "Write clear, concise, and professional memos",
                },
                {
                  name: "Tone Tuner",
                  external: false,
                  img: "/images/welcome/featured-apps-2/tone_tuner.png",
                  href: "/application/acbd4d56-3e85-4150-99cf-4d68f756b65e",
                  description:
                    "Adjust your message to your desired tone",
                }
              ]}
            />
            <Header
              variant="h2"
            >
              Additional Resources
            </Header>
            <Container
              media={{
                content: (
                  <img 
                    src="/images/welcome/additional-resources/innovate-us.png" 
                    alt="Innovate US"
                  />
                ),
                width: isMobile ? "100%" : "33%",
                position: isMobile ? "top" : "side"
              }}
            >
              <Header
                variant="h1"
                description="Join tens of thousands of learners taking Responsible AI for Public Professionals"
              >
                Innovate US - Using Generative AI at Work
              </Header>
              <p>
                Partnering with the Burnes Center for Innovation and Social Change at Northeastern University, the Department of Innovation and Technology has developed a <Link external href="https://innovate-us.org/partner/boston">free, self-paced online training program</Link> to help you integrate GenAI tools into your government work, enhancing public service delivery while managing risks responsibly.
              </p>
              <p>
                Apply what you learn immediately with interactive exercises and benefit from a curriculum shaped by leading professionals across government, industry, and academia. Earn a certificate upon completion to showcase your skills!
              </p>
            </Container>
            <Container
              media={{
                content: (
                  <img 
                    src="/images/welcome/additional-resources/prompt-engineering.jpg" 
                    alt="Prompt Engineering"
                  />
                ),
                width: isMobile ? "100%" : "33%",
                position: isMobile ? "top" : "side"
              }}
            >
              <Header
                variant="h1"
                description="Unlock the full potential of LLMs with accurate, relevant, and contextual Prompts"
              >
                Prompt Engineering & Optimization Guide
              </Header>
              <p>
                This comprehensive <Link external href="https://www.promptingguide.ai">Prompt Engineering Guide</Link> covers the latest techniques, research, and tools to help you:
                <ul>
                  <li>Design effective prompts for optimal model performance</li>
                  <li>Enhance AI safety and reliability</li>
                  <li>Augment LLMs with domain knowledge and external tools</li>
                  <li>Stay ahead with advanced strategies and model-specific insights</li>
                </ul>
              </p>
              <p>
                Whether you're a researcher improving AI reasoning and problem-solving, or a developer crafting precise, reliable interactions with LLMs, mastering prompt engineering is key to unlocking new capabilities.
              </p>
            </Container>
            <Container
              media={{
                content: (
                  <img 
                    src="/images/welcome/additional-resources/ai-guidelines.jpg" 
                    alt="Our Current Guidelines"
                  />
                ),
                width: isMobile ? "100%" : "33%",
                position: isMobile ? "top" : "side"
              }}
            >
              <Header 
                variant="h1"
                description="Learn how to responsibly use Generative AI in your work"
              >
                Our Current AI Guidelines
              </Header>
              <p>
                On May 18th 2023, our Chief Information Officer, Santi Garces, published an <Link external href="https://www.boston.gov/sites/default/files/file/2023/05/Guidelines-for-Using-Generative-AI-2023.pdf">interim set of guidelines</Link> for using Generative AI that would apply to all City agencies and departments with the exception of Boston Public Schools.
              </p>
              <p>
                He stated, "Generative AI is a tool. We are responsible for the outcomes of our tools. For example, if autocorrect unintentionally changes a word, we are still responsible for the text. Technology enables our work, it does not excuse our judgment nor our accountability."
              </p>
              <p>
                Explore the essential dos and don'ts for {" "}
                <strong>drafting documents and letters</strong>,{" "}
                <strong>writing in plain language or other languages</strong>,{" "}
                <strong>summarizing text and audio</strong>,{" "}
                <strong>and even assisting with programming</strong>.{" "}
                Get tips to enhance clarity and effectiveness!
              </p>
            </Container>
          </SpaceBetween>
        </ContentLayout>
      }
    ></BaseAppLayout>
  );
}
