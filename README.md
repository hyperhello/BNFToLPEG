
		
		
		
<h2>Hypervariety BNFToLPEG</h2>

<h3>What is it?</h3>

<b>BNFToLPEG</b> is a compact library that will read in a description of a parsing expression grammar. A <b>grammar</b> defines a set of named <b>rules</b> and how they are combined. Given a grammar, you could <b>parse</b> text and diagram it automatically, link the result to other functions, or even convert the result into a similar grammar. <b>BNF</b> (Backus–Naur form) is a good choice for simple grammars because it is easy to read the <b>declarations</b> (rules, written out).

<h3>Simple example</h3>
In this simple example, we denote rules like this: <b>&lt;Rule&gt;</b>, by enclosing their names in angle brackets. Everything after the name and the equals sign is considered the text of the rule itself except for the special <code>[]</code> (<b>optional</b>) and <code>|</code> (<b>choices</b>). Text parsing with a grammar begins with a <b>start rule</b>, in this case &lt;Sentence&gt;.

    <Sentence> = <Verb> the <Noun>.
    <Sentence> = <Person>, [would you] [please] <Verb> the <Noun>?

    <Verb> = look at | walk to | throw | eat | learn about
    <Noun> = ball | dog | guitar | turkey sandwich
    <Person> = you | Dad | Mr. President | Dog

Given this example, sort of a diagram of a very small part of the English language, we can examine a sentence to see if it fits the grammar. These sentences will fit:

    Look at the ball.
    Eat the turkey sandwich.
    Dad, please walk to the guitar?
    Mr. President, would you please learn about the turkey sandwich?
    Eat the guitar.

These sentences will not fit, because they use text that is not in the grammar, or they do not fit any of the declarations:

    Eat the chocolate.
    Mr. President, dog guitar.
    Dad, would you throw the you?
    Eat the dad.

<h2>Full Documentation</h2>

Available at <a href="https://hypervariety.com/BNFToLPEG/">hypervariety.com/BNFToLPEG/</a>

<h3>How to use BNFToLPEG</h3>

The BNFToLPEG library has almost no options. First, download or link the JavaScript at <a href="BNFToLPEG.js">BNFToLPEG.js</a>
<p>
<code>BNFToLPEGParser(grammar).parse(input).output</code> will construct a parser, parse input, and produce output. Using the <code>success</code> parameter instead of <code>output</code> will access a object containing <code>{ index, endIndex, subrules[], rule, version }</code>, or null if the input didn't fit the grammar. See the text of the script for documentation.
</p><p>
</p><p>
Feel free to use the code in personal projects (noncommercial). Feel free to use the techniques in this document wherever you can.
</p><p>
<b>BNFToLPEG : (c) 2023 Hypervariety Custom Programming</b>

</p>
