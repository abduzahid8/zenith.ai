import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <ScrollViewStyleReset />
                <style dangerouslySetInnerHTML={{ __html: `body{margin:0;} #root{display:flex;flex:1;height:100vh;} html,body{height:100%;overflow:hidden;}` }} />
                {/* Catch JS errors and show them visually instead of white page */}
                <script dangerouslySetInnerHTML={{ __html: `
                    window.onerror = function(msg, url, line, col, error) {
                        var el = document.getElementById('__error_overlay');
                        if (!el) {
                            el = document.createElement('div');
                            el.id = '__error_overlay';
                            el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#fff;color:#333;padding:24px;z-index:99999;font-family:system-ui;overflow:auto;';
                            document.body.appendChild(el);
                        }
                        el.innerHTML = '<h2 style="color:#e53e3e">App Error</h2><pre style="white-space:pre-wrap;word-break:break-word;background:#f7f7f7;padding:16px;border-radius:8px;font-size:13px;">' +
                            msg + '\\n\\nFile: ' + url + '\\nLine: ' + line + ':' + col +
                            (error && error.stack ? '\\n\\nStack:\\n' + error.stack : '') + '</pre>';
                        return true;
                    };
                `}} />
            </head>
            <body>
                <div id="root">{children}</div>
            </body>
        </html>
    );
}
