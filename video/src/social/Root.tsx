import { Composition, Folder, type CalculateMetadataFunction } from "remotion";
import { GlossaryCard, FaqQuoteCard, CarouselSlideView, type CarouselProps } from "./Stills";
import { GlossaryShort, FaqShort, glossaryPlan, faqPlan, FPS, W as VW, H as VH, type GlossaryShortProps, type FaqShortProps } from "./Shorts";
import { buildCarousel, faq, faqCategories, getFaq, getTerm } from "./data";

type Slug = { slug: string };
type Idx = { index: number };

// Unknown slugs / indexes fall back to the first entry, so props typed in Studio never crash a render.
const termMeta: CalculateMetadataFunction<Slug> = ({ props }) => ({ props: { slug: getTerm(props.slug).slug } });
const faqMeta: CalculateMetadataFunction<Idx> = ({ props }) => ({ props: { index: faq.indexOf(getFaq(props.index)) } });
const carouselMeta: CalculateMetadataFunction<CarouselProps> = ({ props }) => {
  const category = faqCategories.includes(props.category) ? props.category : props.slides?.length ? props.category : faqCategories[0];
  const slides = props.slides?.length ? props.slides : buildCarousel(category);
  return { props: { ...props, category, slides, slide: Math.max(0, Math.min(slides.length - 1, props.slide)) } };
};
const glossaryShortMeta: CalculateMetadataFunction<GlossaryShortProps> = ({ props }) => {
  const slug = getTerm(props.slug).slug;
  return { props: { slug }, durationInFrames: glossaryPlan(slug).total };
};
const faqShortMeta: CalculateMetadataFunction<FaqShortProps> = ({ props }) => {
  const index = faq.indexOf(getFaq(props.index));
  return { props: { index }, durationInFrames: faqPlan(index).total };
};

const GCard = (w: number, h: number) => (p: Slug) => <GlossaryCard slug={p.slug} width={w} height={h} />;
const FCard = (w: number, h: number) => (p: Idx) => <FaqQuoteCard index={p.index} width={w} height={h} />;
const GCard4x5 = GCard(1080, 1350), GCard1x1 = GCard(1080, 1080), FCard4x5 = FCard(1080, 1350), FCardWide = FCard(1200, 627);

/** Social templates. Every glossary slug / FAQ index / FAQ category renders by props. */
export const SocialCompositions: React.FC = () => (
  <Folder name="Social">
    <Composition id="GlossaryCard-4x5" component={GCard4x5} width={1080} height={1350} fps={FPS} durationInFrames={1} defaultProps={{ slug: "probate" }} calculateMetadata={termMeta} />
    <Composition id="GlossaryCard-1x1" component={GCard1x1} width={1080} height={1080} fps={FPS} durationInFrames={1} defaultProps={{ slug: "probate" }} calculateMetadata={termMeta} />
    <Composition id="FaqCard-4x5" component={FCard4x5} width={1080} height={1350} fps={FPS} durationInFrames={1} defaultProps={{ index: 0 }} calculateMetadata={faqMeta} />
    <Composition id="FaqCard-landscape" component={FCardWide} width={1200} height={627} fps={FPS} durationInFrames={1} defaultProps={{ index: 0 }} calculateMetadata={faqMeta} />
    <Composition id="Carousel-4x5" component={CarouselSlideView} width={1080} height={1350} fps={FPS} durationInFrames={1}
      defaultProps={{ category: faqCategories[0], slides: [], slide: 0 } satisfies CarouselProps} calculateMetadata={carouselMeta} />
    <Composition id="GlossaryShort" component={GlossaryShort} width={VW} height={VH} fps={FPS} durationInFrames={FPS * 14} defaultProps={{ slug: "probate" }} calculateMetadata={glossaryShortMeta} />
    <Composition id="FaqShort" component={FaqShort} width={VW} height={VH} fps={FPS} durationInFrames={FPS * 20} defaultProps={{ index: 0 }} calculateMetadata={faqShortMeta} />
  </Folder>
);
