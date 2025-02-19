import {mathjax} from 'mathjax-full/js/mathjax';
import {TeX} from 'mathjax-full/js/input/tex';
import {SVG} from 'mathjax-full/js/output/svg';
import {AllPackages} from 'mathjax-full/js/input/tex/AllPackages';
import {liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html';
import {initial, signal} from '../decorators';
import {Image, ImageProps} from './Image';
import {
  DependencyContext,
  SignalValue,
  SimpleSignal,
} from '@motion-canvas/core/lib/signals';
import {OptionList} from 'mathjax-full/js/util/Options';
import {useLogger} from '@motion-canvas/core/lib/utils';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const jaxDocument = mathjax.document('', {
  InputJax: new TeX({packages: AllPackages}),
  OutputJax: new SVG({fontCache: 'local'}),
});

export interface LatexProps extends ImageProps {
  tex?: SignalValue<string>;
  renderProps?: SignalValue<OptionList>;
}

export class Latex extends Image {
  private static svgContentsPool: Record<string, string> = {};

  private readonly imageElement = document.createElement('img');

  @initial({})
  @signal()
  public declare readonly options: SimpleSignal<OptionList, this>;

  @signal()
  public declare readonly tex: SimpleSignal<string, this>;

  public constructor(props: LatexProps) {
    super(props);
  }

  protected override image(): HTMLImageElement {
    // Render props may change the look of the TeX, so we need to cache both
    // source and render props together.
    const src = `${this.tex()}::${JSON.stringify(this.options())}`;
    if (Latex.svgContentsPool[src]) {
      this.imageElement.src = Latex.svgContentsPool[src];
      return this.imageElement;
    }

    // Convert to TeX, look for any errors
    const tex = this.tex();
    const svg = adaptor.innerHTML(jaxDocument.convert(tex, this.options()));
    if (svg.includes('data-mjx-error')) {
      const errors = svg.match(/data-mjx-error="(.*?)"/);
      if (errors && errors.length > 0) {
        useLogger().error(`Invalid MathJax: ${errors[1]}`);
      }
    }

    // Encode to raw base64 image format
    const text = `data:image/svg+xml;base64,${btoa(
      `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n${svg}`,
    )}`;
    Latex.svgContentsPool[src] = text;
    const image = document.createElement('img');
    image.src = text;
    image.src = text;
    if (!image.complete) {
      DependencyContext.collectPromise(
        new Promise((resolve, reject) => {
          image.addEventListener('load', resolve);
          image.addEventListener('error', reject);
        }),
      );
    }

    return image;
  }
}
