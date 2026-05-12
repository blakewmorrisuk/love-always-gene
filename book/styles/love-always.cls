%% love-always.cls
%% Custom XeLaTeX book class for `Love, Always — The Wartime Letters of
%% Raymond Eugene Lankford`. 6x9 trim, private family print run.
%%
%% Designed to be a starting point for a book designer (or Claude Design) to
%% take over. Typography mirrors the web version at
%% blakewmorrisuk.github.io/love-always-gene. All custom environments are
%% defined below; tweak them, do not rewrite them, to keep the build script
%% (build_book.py) working.

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{love-always}[2026/05/12 v0.1 Love, Always book class]

% ----------------------------------------------------------------------------
% Base class: memoir (full-featured for book design).
% ----------------------------------------------------------------------------
\LoadClass[11pt, twoside, openright, letterpaper=false]{memoir}

% ----------------------------------------------------------------------------
% Required packages.
% ----------------------------------------------------------------------------
\RequirePackage{fontspec}
\RequirePackage{microtype}
\RequirePackage{xcolor}
\RequirePackage{graphicx}
\RequirePackage{xkeyval}
\RequirePackage{tcolorbox}
\tcbuselibrary{skins, breakable}
\RequirePackage{ragged2e}
\RequirePackage{lettrine}
\RequirePackage{soul}
\RequirePackage{calc}
\RequirePackage{etoolbox}

% ----------------------------------------------------------------------------
% Page geometry: 6x9 trim, designed margins.
% Inner 0.75 in, outer 0.6 in, top 0.75 in, bottom 0.9 in.
% Lulu requires 0.5 in safe margins; we are well inside that.
% ----------------------------------------------------------------------------
\setstocksize{9in}{6in}
\settrimmedsize{9in}{6in}{*}
\settrims{0pt}{0pt}
\setlrmarginsandblock{0.75in}{0.6in}{*}
\setulmarginsandblock{0.75in}{0.9in}{*}
\setheadfoot{14pt}{30pt}
\setheaderspaces{*}{18pt}{*}
\checkandfixthelayout

% ----------------------------------------------------------------------------
% Color palette (mirrors the website's CSS variables).
% Print proofs in black-only first; the brass and walnut accents render in
% black at high density on a one-color press. The designer can ink up the
% accent in a 2-color edition later.
% ----------------------------------------------------------------------------
\definecolor{paper}{HTML}{F5EFE0}
\definecolor{paperdeep}{HTML}{EDE4CC}
\definecolor{ink}{HTML}{1F1B17}
\definecolor{walnut}{HTML}{3B2A1A}
\definecolor{walnutsoft}{HTML}{5C4733}
\definecolor{walnutmute}{HTML}{806852}
\definecolor{brass}{HTML}{9B7B3F}
\definecolor{brasssoft}{HTML}{C8AC74}
\definecolor{brassfaint}{HTML}{E2D1A9}
\definecolor{telegramcream}{HTML}{E8DDC4}
\definecolor{navy}{HTML}{1F2D3D}

% ----------------------------------------------------------------------------
% Fonts.
% Place the OTF / TTF files in ../fonts/ relative to this class, or change
% Path= below. See book/README.md for download links. If the designer swaps
% to commercially-licensed equivalents (Adobe Garamond Premier Pro, Source
% Serif Pro, Adobe Handwriting, FF DIN Mono, etc.), only the four
% \setmainfont / \setsansfont / \newfontfamily calls below need to change.
% ----------------------------------------------------------------------------
\defaultfontfeatures{Path=../fonts/, Ligatures=TeX}

% Display (Cormorant Garamond italic for chapter, part, drop-caps).
\newfontfamily\displayfont{CormorantGaramond}[
    UprightFont    = *-Regular.ttf,
    ItalicFont     = *-Italic.ttf,
    BoldFont       = *-SemiBold.ttf,
    BoldItalicFont = *-SemiBoldItalic.ttf,
    Numbers={OldStyle, Proportional}
]

% Body (Source Serif 4 — variable optical size font).
\setmainfont{SourceSerif4}[
    UprightFont    = *-Regular.otf,
    ItalicFont     = *-Italic.otf,
    BoldFont       = *-SemiBold.otf,
    BoldItalicFont = *-SemiBoldItalic.otf,
    Numbers={OldStyle, Proportional}
]

% Handwriting (Caveat — used for Gene's signature, sign-offs, salutations).
\newfontfamily\handfont{Caveat}[
    UprightFont = *-Regular.ttf,
    BoldFont    = *-SemiBold.ttf,
    Scale=1.18
]

% Mono small-caps (JetBrains Mono — used for dates, locations, postmarks).
\newfontfamily\monofont{JetBrainsMono}[
    UprightFont = *-Regular.ttf,
    BoldFont    = *-SemiBold.ttf,
    Scale=0.86,
    Numbers={Lining, Tabular}
]

% Convenience macros.
\newcommand{\eyebrow}[1]{{\monofont\addfontfeature{LetterSpace=18}\MakeUppercase{#1}}}
\newcommand{\handwritten}[1]{{\handfont #1}}

% ----------------------------------------------------------------------------
% Body type settings.
% 11pt / 14pt leading, justified with optical micro-protrusion.
% ----------------------------------------------------------------------------
\setlength{\parindent}{1.2em}
\linespread{1.08} % ~14pt leading at 11pt body
\nonzeroparskip

\microtypesetup{
    protrusion=true,
    expansion=true,
    final
}

% ----------------------------------------------------------------------------
% Folio (running foot).
% Mono small caps, centered, with a single brass rule above. Empty on part
% title openings, dedication, and any unnumbered front matter.
% ----------------------------------------------------------------------------
\copypagestyle{laempty}{empty}
\makepagestyle{laplain}
\makeevenfoot{laplain}{}{\monofont\addfontfeature{LetterSpace=22}\thepage}{}
\makeoddfoot{laplain}{}{\monofont\addfontfeature{LetterSpace=22}\thepage}{}
\makeevenhead{laplain}{}{}{}
\makeoddhead{laplain}{}{}{}
\pagestyle{laplain}

% ----------------------------------------------------------------------------
% Brass horizontal rule used above the folio and elsewhere.
% ----------------------------------------------------------------------------
\newcommand{\brassrule}[1][14pt]{%
    {\centering
        {\color{brass}\rule{#1}{0.4pt}}\par}}

\newcommand{\brassornament}{%
    \begin{center}
        {\color{brass}\rule{18pt}{0.4pt}}\quad
        {\color{brass}$\diamond$}\quad
        {\color{brass}\rule{18pt}{0.4pt}}
    \end{center}}

% ----------------------------------------------------------------------------
% Part title pages.
% Roman numeral, italic part name, location + dates in mono small-caps,
% bridge paragraph in italic body size below. The verso of the part title
% page carries a large faint Roman numeral watermark (see \partwatermark).
% ----------------------------------------------------------------------------
\renewcommand{\partnamefont}{\normalsize\monofont\addfontfeature{LetterSpace=32}\color{brass}}
\renewcommand{\partnumfont}{\normalsize\monofont\addfontfeature{LetterSpace=32}\color{brass}}
\renewcommand{\parttitlefont}{\Huge\displayfont\itshape\color{ink}}
\renewcommand{\printpartname}{}
\renewcommand{\printpartnum}{}
\renewcommand{\printparttitle}[1]{\parttitlefont #1}

\newcommand{\partlocation}[1]{%
    \vspace{0.6em}
    {\centering\eyebrow{#1}\par}%
}
\newcommand{\partdates}[1]{%
    \vspace{0.4em}
    {\centering\eyebrow{#1}\par}%
}
\newcommand{\partbridge}[1]{%
    \vspace{2.5em}
    \begin{center}
        \begin{minipage}{0.78\textwidth}
            \centering\displayfont\itshape\large\color{walnutsoft}
            #1
        \end{minipage}
    \end{center}
}
\newcommand{\partwatermark}[1]{%
    % Drops the Roman numeral as a giant faint watermark on the verso.
    \begin{textblock*}{6in}(0in,2.6in)%
        {\centering\Huge\fontsize{220pt}{220pt}\selectfont\displayfont\itshape%
            \color{brassfaint!40}#1\par}%
    \end{textblock*}%
}
% textpos for watermark
\RequirePackage[absolute,overlay]{textpos}
\setlength{\TPHorizModule}{1pt}
\setlength{\TPVertModule}{1pt}

% ----------------------------------------------------------------------------
% Letter metadata keys (used by all letter-like environments).
% ----------------------------------------------------------------------------
\define@key{laletter}{id}{\def\laletter@id{#1}}
\define@key{laletter}{date}{\def\laletter@date{#1}}
\define@key{laletter}{datelabel}{\def\laletter@datelabel{#1}}
\define@key{laletter}{location}{\def\laletter@location{#1}}
\define@key{laletter}{status}{\def\laletter@status{#1}}
\define@key{laletter}{statuslabel}{\def\laletter@statuslabel{#1}}
\define@key{laletter}{pagecount}{\def\laletter@pagecount{#1}}
\define@key{laletter}{returnaddress}{\def\laletter@returnaddress{#1}}

% Defaults — every key reset at \begin of each environment.
\newcommand{\laletter@resetkeys}{%
    \def\laletter@id{}%
    \def\laletter@date{}%
    \def\laletter@datelabel{}%
    \def\laletter@location{}%
    \def\laletter@status{}%
    \def\laletter@statuslabel{}%
    \def\laletter@pagecount{}%
    \def\laletter@returnaddress{}%
}

% ----------------------------------------------------------------------------
% Letter masthead.
% Brass rule, postmark line (location + date in mono small-caps), folio rule.
% Renders at the top of every letter-like environment.
% ----------------------------------------------------------------------------
\newcommand{\letterMasthead}{%
    \vspace*{0.4em}
    \begin{center}
        \brassrule[28pt]
        \vspace{0.5em}
        {\eyebrow{\laletter@location}\par}
        \vspace{0.25em}
        {\eyebrow{\laletter@datelabel}\par}
        \vspace{0.4em}
        \brassrule[28pt]
        \vspace{0.6em}
        {\monofont\small\color{walnutmute}
            \laletter@id%
        }
    \end{center}
    \vspace{1.4em}
}

% ----------------------------------------------------------------------------
% Address block used inside the body of certain letters (the inside-page
% return address, before Dearest Joan;). Tight stack, right-justified.
% ----------------------------------------------------------------------------
\newenvironment{addressblock}
    {\par\smallskip\noindent\begin{flushright}\monofont\small\color{walnutsoft}\begin{tabular}{r}}
    {\end{tabular}\end{flushright}\par\smallskip}

% ----------------------------------------------------------------------------
% \salutation, \postscript, \signature — used uniformly across all letter
% environments.
% ----------------------------------------------------------------------------
\newcommand{\salutation}[1]{%
    \par\vspace{0.6em}\noindent
    {\displayfont\itshape\large #1}\par\vspace{0.6em}%
}
\newcommand{\postscript}[1]{%
    \par\vspace{0.8em}\noindent
    {\small\itshape #1}\par%
}
\newcommand{\signature}[1]{%
    \par\vspace{1.2em}
    \begin{flushright}
        {\handfont\large #1}
    \end{flushright}
    \vspace{0.6em}
}

% ----------------------------------------------------------------------------
% Status colophon (rendered below the signature when the letter is not a
% clean transcription — e.g. draft OCR, partial, vision-OCR).
% ----------------------------------------------------------------------------
\newcommand{\statusColophon}{%
    \ifx\laletter@status\@empty\else
        \ifx\laletter@status\la@status@clean\else
            \par\vspace{1em}
            \brassrule[14pt]
            \vspace{0.4em}
            \begin{center}
                {\monofont\footnotesize\color{walnutmute}
                    \eyebrow{\laletter@statuslabel}\par}
            \end{center}
        \fi
    \fi
}
\def\la@status@clean{transcribed}

% ----------------------------------------------------------------------------
% Environment: \begin{letter}{...} — the standard transcribed letter.
% Letters open on a fresh recto when possible (cleardoublepage). The
% designer may relax this to save pagecount.
% ----------------------------------------------------------------------------
\newenvironment{letter}[1][]
    {\cleardoublepage
     \laletter@resetkeys
     \setkeys{laletter}{#1}%
     \letterMasthead
     \RaggedRight\setlength{\parindent}{1.2em}}
    {\statusColophon\par\vspace*{\fill}\clearpage}

% ----------------------------------------------------------------------------
% Environment: \begin{envelopeonly}{...} — envelope-only entries.
% Small, quiet page. No salutation/body/signature; just metadata + a one-line
% editor note. The note comes through as the body content from the markdown.
% ----------------------------------------------------------------------------
\newenvironment{envelopeonly}[1][]
    {\cleardoublepage
     \laletter@resetkeys
     \setkeys{laletter}{#1}%
     \letterMasthead
     \begin{center}
         \begin{minipage}{0.72\textwidth}
             \itshape\small\color{walnutsoft}\RaggedRight}
    {\end{minipage}\end{center}\par\vspace*{\fill}\clearpage}

% ----------------------------------------------------------------------------
% Environment: \begin{telegram}{...} — Western Union / Postal Telegraph.
% Constrained measure, monospace block over a tinted cream box.
% ----------------------------------------------------------------------------
\newenvironment{telegram}[1][]
    {\cleardoublepage
     \laletter@resetkeys
     \setkeys{laletter}{#1}%
     \letterMasthead
     \begin{tcolorbox}[
         colback=telegramcream,
         colframe=brasssoft,
         boxrule=0.4pt,
         arc=0pt,
         outer arc=0pt,
         left=2em, right=2em, top=1.4em, bottom=1.4em,
         enhanced jigsaw
     ]
     \monofont\footnotesize\addfontfeature{LetterSpace=10}\RaggedRight}
    {\end{tcolorbox}\par\vspace*{\fill}\clearpage}

% ----------------------------------------------------------------------------
% Environment: \begin{christmascard}{...} — printed verse + handwritten sig.
% Center-aligned inset block, italic verse, signature in Caveat.
% ----------------------------------------------------------------------------
\newenvironment{christmascard}[1][]
    {\cleardoublepage
     \laletter@resetkeys
     \setkeys{laletter}{#1}%
     \letterMasthead
     \begin{center}
         \begin{minipage}{0.68\textwidth}
             \centering\displayfont\itshape\large\color{walnutsoft}}
    {\end{minipage}\end{center}\par\vspace*{\fill}\clearpage}

% ----------------------------------------------------------------------------
% Environment: \begin{vmail}{...} — V-Mail (Victory Mail).
% Constrained measure (V-Mail forms were small), thin Navy-seal motif at top.
% ----------------------------------------------------------------------------
\newenvironment{vmail}[1][]
    {\cleardoublepage
     \laletter@resetkeys
     \setkeys{laletter}{#1}%
     \letterMasthead
     \begin{center}
         \begin{minipage}{0.74\textwidth}
             \RaggedRight\monofont\small}
    {\end{minipage}\end{center}\par\vspace*{\fill}\clearpage}

% ----------------------------------------------------------------------------
% Environment: \begin{fromothers}{...} — letters written by someone other
% than Gene (L101 Don Chapin; L102 Mrs. Parkhurst). Italic eyebrow announces
% the sender; body styled like a regular letter underneath.
% ----------------------------------------------------------------------------
\newenvironment{fromothers}[1][]
    {\cleardoublepage
     \laletter@resetkeys
     \setkeys{laletter}{#1}%
     \begin{center}
         \displayfont\itshape\large\color{walnutsoft}
         A letter not from Gene
     \end{center}
     \vspace{0.4em}
     \letterMasthead
     \RaggedRight\setlength{\parindent}{1.2em}}
    {\par\vspace*{\fill}\clearpage}

% ----------------------------------------------------------------------------
% Chapter / part display tweaks for memoir.
% ----------------------------------------------------------------------------
\chapterstyle{section}
\setsecnumdepth{part}
\renewcommand{\thepart}{\Roman{part}}

% ----------------------------------------------------------------------------
% \openpart{NUMERAL}{NAME}{LOCATION}{DATES}{BRIDGE}
% Renders a part title page on a recto, with a large faint watermark on the
% verso behind the bridge. Every part file calls this once before \input{}ing
% its auto-generated letters file.
% ----------------------------------------------------------------------------
\newcommand{\openpart}[5]{%
    \cleardoublepage
    \thispagestyle{laempty}%
    \vspace*{0.10\textheight}
    \begin{center}
        {\monofont\addfontfeature{LetterSpace=36}\color{brass}PART\quad #1}\par
        \vspace{1.6em}
        \brassornament
        \vspace{1.4em}
        {\Huge\displayfont\itshape\color{ink} #2\par}
        \vspace{1.2em}
        \partlocation{#3}
        \partdates{#4}
    \end{center}
    \vfill
    % Verso of the part-title spread: faint Roman numeral watermark + bridge.
    \cleartoverso
    \thispagestyle{laempty}%
    \partwatermark{#1}%
    \vspace*{0.30\textheight}
    \partbridge{#5}%
    \cleardoublepage
}

% Force-page-to-verso helper (memoir lacks a direct equivalent of cleardouble*).
\newcommand{\cleartoverso}{\clearpage\ifodd\value{page}\hbox{}\thispagestyle{laempty}\newpage\fi}

% ----------------------------------------------------------------------------
% Default first-page style on a part title.
% ----------------------------------------------------------------------------
\aliaspagestyle{part}{laempty}

% End of class.
