import { marked } from 'marked';
import brief from '../docs/product-brief.md?raw';
import architecture from '../docs/architecture.md?raw';
import backendFlow from '../docs/assets/backend-flow.svg?url';
import './documents.css';

// Only repository-authored Markdown is rendered here.
const documents = {
  brief: marked.parse(brief.replace('](architecture.md)', '](#architecture)'), { async: false }),
  architecture: marked.parse(architecture
    .replace('](assets/backend-flow.svg)', '](<' + backendFlow + '>)')
    .replace('](../public/evaluation/', '](./evaluation/'), { async: false }),
};

export default function Documents({ page }: { page: keyof typeof documents }) {
  return <article className={'reading ' + page} dangerouslySetInnerHTML={{ __html: documents[page] }} />;
}
