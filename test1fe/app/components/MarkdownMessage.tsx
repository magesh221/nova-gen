"use client";

import { Children, isValidElement, type ReactNode, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

function codeText(children: ReactNode) {
    return Children.toArray(children).map((child) => {
        if (isValidElement<{ children?: ReactNode }>(child)) return Children.toArray(child.props.children).join("");
        return String(child);
    }).join("");
}

export default function MarkdownMessage({ content }: { content: string }) {
    const [copiedCode, setCopiedCode] = useState(false);

    const components: Components = {
        h1: ({ children }) => <h1 className="mb-3 mt-5 text-xl font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-4 font-bold">{children}</h3>,
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-blue-300 pl-4 text-slate-500">{children}</blockquote>,
        table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-left">{children}</table></div>,
        th: ({ children }) => <th className="border border-slate-300 bg-slate-100 px-3 py-2 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border border-slate-300 px-3 py-2">{children}</td>,
        code: ({ children, className }) => className
            ? <code className={`${className} font-mono`}>{children}</code>
            : <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>,
        pre: ({ children }) => (
            <div className="my-4 overflow-hidden rounded-xl border border-slate-700 bg-[#0d1117] text-slate-100">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
                    <span>Code</span>
                    <button
                        type="button"
                        onClick={async () => {
                            await navigator.clipboard.writeText(codeText(children));
                            setCopiedCode(true);
                            window.setTimeout(() => setCopiedCode(false), 1500);
                        }}
                        className="rounded px-2 py-1 hover:bg-white/10 hover:text-white"
                    >{copiedCode ? "Copied" : "Copy code"}</button>
                </div>
                <pre className="chat-code-overflow m-0 overflow-x-auto p-4 text-sm leading-6">{children}</pre>
            </div>
        ),
        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2">{children}</a>,
        hr: () => <hr className="my-4 border-slate-200" />,
    };

    return <div className="markdown-content min-w-0"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>{content}</ReactMarkdown></div>;
}
