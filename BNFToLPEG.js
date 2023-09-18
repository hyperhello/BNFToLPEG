/*
 
 (c) 2023 Hypervariety Custom Software. All rights reserved.
 
 BNFToLPEG is (c) 2023 Hypervariety Custom Programming, LLC. All rights reserved. Non-commercial use is permitted by the author, as long as this copyright message accompanies the product and source. For commercial use, please contact Hypervariety.
 */

/* Calling BNFToLPEGParser(grammar) with a BNF grammar returns an LPEG parser object. The parser will convert input text to a grammar, and to output text. Whitespace is ignored except between words and numbers, and character case is not honored. */

/* A grammar is rule declarations such as the following, plus any RegExp values you pass in the regex_rules object: { number: /[\d]+/y }, etc.
 
        <Rule> = this is the first rule
        <Rule> = you can have multiple versions of any rule
        <Rule> = [ you can enclose optional rules in square brackets ], and you can [ optionally parse multiple times ]*
        <Rule> = { curly brace rules are not optional } and you can { repeat at least once }*
        <Rule> = choices are | separated | with | the | pipe symbol.
        <Rule> = <Rule> is very smart about including itself in itself. Again: <Rule>
        <Rule> = <number> + <number>
        <Rule> = <something> and <somethingElse> => after the arrow symbol, you can change output: <somethingElse> <something>
 
 Besides <rule>, [], []*, []&, {}, {}*, {}&, |, and the first =>, all symbols are considered part of the grammar.

 With a parser, use parser.parse(input) to produce an instance of a BNFToLPEGResult object. This has the members

    parser.parse(input).output : a string containing the parsed output, or the text itself if no output has been set, or an empty string

    parser.parse(input).success : either null, or a recursive data structure containing { index, endIndex, subrules[], rule, version }

Example of use:

    var grammar = ' <rule> = {a}* b ';
    var parser = BNFToLPEGParser(grammar);
    var input = ' a a a a a b';
    var result = parser.parse(input);
    var output = result.output;
    if (result.success)
    {
        var length = result.success.endIndex - result.success.index;
    }
 
*/

"use strict";


function BNFToLPEGParser(grammar, regex_rules)
{
	// create the parser object we will return
	var parser = 
	{
		// key is the rule name, and the value is an array of versions
		rules: {},
		
		// name of the default rule which begins as the first defined rule
		default_start_rule: undefined,
		
        // log the grammar errors found
        errors: [],
        
		// you can call .parse() to get a result
		parse(text, start_rule)
		{
			start_rule = start_rule ? String(start_rule) : parser.default_start_rule;
			return new BNFToLPEGResult(String(text), start_rule);
		}
		
	};
	
	// read in the supplied grammar
	var grammar = String(grammar), g = 0, gline, match, 
		regex_whitespace = /([^\S\n]*)/y,
		regex_ruletag = /[^\S\n]*<([A-Z0-9_]+)>/yi,
		regex_literal = /[^\S\n]*([A-Z0-9_]+)/yi, 
		regex_open = /[^\S\n]*([\[\{])/y, 
		regex_close = /[^\S\n]*([\]\}][\*\@]?)/y, 
		regex_choice = /[^\S\n]*([|])/y, 
		regex_output = /[^\S\n]*([=][>])/y, 
		regex_linefeed = /[^\S\n]*([\n])/y,
		regex_misc = /[^\S\n]*([^\s\nA-Z0-9_])/iy;
	
	function get_grammar(regex, peek, with_whitespace) 
	{ 
		regex.lastIndex = g; 
		return (match=regex.exec(grammar)) && ((peek || (g=regex.lastIndex)),match[with_whitespace ? 0 : 1]); 
	}
	
	function get_subtree(is_at_rule_level)
	{
		var tokens = [], choices = [];
		do
		{
			var token;
			
			if (token=get_grammar(regex_ruletag))
			{
				tokens.push({ rule: token.toLowerCase() });
			}
			else if (token=get_grammar(regex_choice))
			{
				if (tokens.length)
					choices.push(tokens);
				tokens = [];
			}
			else if (token=get_grammar(regex_open))
			{
				var pair = { bracket: token, inner: get_subtree(false) };
				tokens.push(pair);
				
				token = get_grammar(regex_close);
				if ( !token || (pair.bracket[0]=='[' && token[0] != ']')|| (pair.bracket[0]=='{' && token[0] != '}') )
					console.log("expected ending bracket for " + pair.bracket, grammar.substr(gline).split('\n')[0]);
				else if (token[1]=='*' || token[1]=='@')
					pair.feature = token[1];
			}
			else if (token=get_grammar(regex_literal))
			{
				tokens.push(token);
			}
			else if (!get_grammar(regex_output,true) && !get_grammar(regex_close,true) && (token=get_grammar(regex_misc)))
			{
				tokens.push(token);
			}
			else
			{
				break;
			}
					
		} while (true);
		
		if (choices.length)
			return [{ choice: choices.concat([tokens]) }];
		return tokens;
	}
		
	while (g < grammar.length)
	{
		gline = g;
		
		var rule = get_grammar(regex_ruletag);
		if (!rule)
		{
			get_grammar(regex_whitespace);
			
			if (get_grammar(regex_linefeed) || g == grammar.length)
				continue;
		}
		
		if (!rule || get_grammar(regex_misc) != '=' || (get_grammar(regex_whitespace),get_grammar(regex_linefeed) || g == grammar.length))
		{
			parser.errors.push("expected a rule declaration at " + grammar.substr(gline).split('\n')[0]);
			g += grammar.substr(gline).split('\n')[0].length;
			continue;
		}

        if (rule)
            rule = rule.toLowerCase();
        
		// record the default rule if this is the first one
		if (!parser.default_start_rule)
			parser.default_start_rule = rule;
		
        var new_line_choice = false;
		do
		{
			// parse the rule version as an array of tokens
			var version = { name: rule, input: get_subtree(true) };
            
            // if a version has other choices on new lines, we record that, because left-recursion works slightly differently
			if (new_line_choice)
                version.new_line_choice = true;
            new_line_choice = true;
            
			get_grammar(regex_linefeed);
			
			if (get_grammar(regex_output))
			{
				// read in an output for the rule
				var token;
				version.output = [];
				
				do
				{
					if (token=get_grammar(regex_ruletag))
					{
						version.output.push({ rule: token.toLowerCase() });
					}
					else if (token=get_grammar(regex_literal, false, !!version.output.length))
					{
						version.output.push(token + get_grammar(regex_whitespace));
					}
					else if (token=get_grammar(regex_misc, false, !!version.output.length))
					{
						version.output.push(token + get_grammar(regex_whitespace));
					}
					else
					{
						break;
					}
					
				} while (true);

				get_grammar(regex_linefeed);
			}
						
			if (!parser.rules[rule])
				parser.rules[rule] = [];
			parser.rules[rule].push(version);
			
			get_grammar(regex_linefeed);
			
			if (get_grammar(regex_choice))
			{
				// get another version of the rule on this line
				continue;
			}
			break;
		}
		while (true);
        
	}

    // also include regex expressions supplied as grammar rules
    for (var rule in regex_rules)
    {
        if (regex_rules[rule] instanceof RegExp)
        {
            if (!parser.rules[rule])
                parser.rules[rule] = [];
            parser.rules[rule].push({ name: rule, input: [ { regex: regex_rules[rule] } ] });
        }
    }
    
    // let's examine the grammar
    for (var rule in parser.rules)
    {
        for (var v = 0; v < parser.rules[rule].length; v++)
        {
            var version = parser.rules[rule][v];
            var version_rules = [];
            
            // copy the appropriate version arrays to the rule tokens
            link_rule_references(version.input);

            // make sure each rule reference in the output is appropriate
            if (version.output)
            {
                version.output.forEach((token)=>
                {
                    if (token instanceof Object && token.rule)
                    {
                        if (!version_rules.includes(token.rule))
                            parser.errors.push('<' + rule + '> ' + (v+1) + ' outputs unused rule <' + token.rule + '>');
                    }
                });
            }
            
            // alter the version arrays to use a later choice if a rule is left and right recursive
            // a rule that is simulateously left and right recursive needs the right rule to start at the next version
            var first = get_first(version.input), last = get_last(version.input);
            if (first !== last && first instanceof Object && first.rule == rule && last instanceof Object && last.rule == rule)
            {
                last.first_version = v;
                do
                {
                    last.first_version++;
                    if (!parser.rules[rule][last.first_version])
                    {
                        parser.errors.push(rule + ' version ' + v + ' is left and right recursive but has no later choice');
                        break;
                    }
                }
                while (parser.rules[rule][last.first_version].new_line_choice);
            }
            
            // link rule references in the subtree
            function link_rule_references(tokens)
            {
                tokens.forEach((token)=>
                {
                    if (token instanceof Object && token.rule)
                    {
                        version_rules.push(token.rule);
                        
                        // statically link the rule to its versions
                        token.rule_versions = parser.rules[token.rule];
                        if (!token.rule_versions)
                        {
                            parser.errors.push('<' + rule + '> ' + (v+1) + ' refers to unknown rule <' + token.rule + '>');
                            token.rule_versions = [];
                        }
                    }
                    else if (token instanceof Object && token.inner)
                    {
                        link_rule_references(token.inner);
                    }
                    else if (token instanceof Object && token.choice)
                    {
                        token.choice.forEach((choice)=>link_rule_references(choice));
                    }

                });
            }
            
            function get_first(tokens)
            {
                return tokens[0] && tokens[0].inner ? get_first(tokens[0].inner) : tokens[0];
            }
            function get_last(tokens)
            {
                return tokens[tokens.length-1] && tokens[tokens.length-1].inner ? get_first(tokens[tokens.length-1].inner) : tokens[tokens.length-1];
            }
        }
    }
    
    if (parser.errors.length)
    {
        console.log('This grammar has errors', parser.errors);
    }
    
    // and return the ready-to-use parser
    return parser;
    
    
    // the result object of a parse, you get this from BNFToLPEGParse.parse()
	function BNFToLPEGResult(text, rule)
	{
		var i = 0;          // current index into text
        var packrat = [];   // array keys are index, value is object of { rule: result }
        var output = [];    // for build_output

        var rule_versions = parser.rules[rule];
        if (!rule_versions)
        {
            console.log('Unable to find rule declaration <' + rule + '>');
            return null;
        }
        
        while (/[^\S\n]/.test(text[i] || ""))
            { i++; }

		if (this.success=parse_rule_versions(rule, rule_versions))
        {
            build_output(this.success);
            this.output = output.join('');
        }
        else
        {
            this.output = "";
        }
        
        function build_output(result)
        {
            var rule_version = parser.rules[result.rule][result.version];
            
            if (rule_version.output)
            {
                // this version has a defined output
                var used_subrules = [];     // output each subrule once, then just reuse the first one
                
                rule_version.output.forEach((token)=>
                {
                    if (typeof token === 'string')
                    {
                        output.push(token)
                    }
                    else if (token.rule)
                    {
                        var subrule = result.subrules.find((s)=>(s.rule===token.rule) && !used_subrules.includes(s))
                            || result.subrules.find((s)=>(s.rule===token.rule));
                        if (subrule)
                        {
                            used_subrules.push(subrule);
                            build_output(subrule);
                        }
                    }
                })
            }
            else
            {
                // this version has no special defined output, so just send the input back out
                var i = result.index;
                result.subrules.forEach((subrule)=>
                {
                    output.push(text.substring(i, subrule.index));
                    build_output(subrule);
                    i = subrule.endIndex;
                });
                output.push(text.substring(i, result.endIndex));
            }
        }

		return this;
				
		function parse_rule_versions(rule, rule_versions, first_version = 0)
		{
            var rule_results, rule_i = i, packrat_location = packrat[rule_i], packrat_entry;
            
            if (packrat_location)
            {
                if (rule in packrat_location)
                {
                    // result can be null for a fail, or the previously saved result, or a stub for trying left-recursion
                    packrat_entry = packrat_location[rule];
                    
                    if (packrat_entry)
                    {
                        if (packrat_entry.in_progress)
                        {
                            if (packrat_entry.seed)
                            {
                                // the result of the left recursion this time is the current seed
                                i = packrat_entry.seed.endIndex;
                                return packrat_entry.seed;
                            }
                            else
                            {
                                // this is a stub left the first time around, we mark it yes and return a no-parse
                                packrat_entry.is_left_recursion = true;
                                return null;
                            }
                        }
                        
                        // return the saved parse
                        i = packrat_entry.endIndex;
                    }
                    
                    return packrat_entry;
                }
            }
            else
            {
                packrat_location = {};
                packrat[rule_i] = packrat_location;
            }
            
            // store a packrat stub before parsing for any left-recursion to find
            packrat_entry = { in_progress: true };
            packrat_location[rule] = packrat_entry;
            
			for (var v = first_version; v < rule_versions.length; v++)
			{
                rule_results = [];
				if (parse_token_array(rule_versions[v].input, false))
				{
                    var result = { rule: rule, version: v, subrules: rule_results, index: rule_i, endIndex: i };
                    
                    if (packrat_entry.is_left_recursion)
                    {
                        // store the seed and repeat to grow it.
                        do
                        {
                            packrat_entry.seed = result;
                            result = null;
                            i = rule_i;

                            // try the versions again
                            for (var lr_v = first_version; lr_v < rule_versions.length; lr_v++)
                            {
                                rule_results = [];
                                
                                if (parse_token_array(rule_versions[lr_v].input, false))
                                {
                                    // we had a result, although we haven't accepted it yet
                                    result = { rule: rule, version: lr_v, subrules: rule_results, index: rule_i, endIndex: i };
                                    break;
                                }
                            }
                        }
                        while (result && i > packrat_entry.seed.endIndex);
                        
                        // left-recursion complete because it did not produce a longer successful parse when repeated
                        result = packrat_entry.seed;
                        i = result.endIndex;
                    }
                    
                    // store the result
                    packrat_location[rule] = result;
                    
                    // return the result
                    return result;
				}
			}
			
            // we didn't get a successful parse
            packrat_location[rule] = null;
			return null;

            // parse through the text at i. if success return true and advance i. if failure return false and restore i.
            function parse_token_array(tokens, disallow_empty)
            {
                var startI = i;
                        
                for (var t = 0; t < tokens.length; t++)
                {
                    while (/[^\S\n]/.test(text[i]))
                        { i++; }
                    if (!parse_one_token(tokens[t]))
                    {
                        i = startI;
                        return false;
                    }
                    
                }
                
                if (disallow_empty && startI === i)
                {
                    return false;
                }
                
                return true;
            }
            
            // parse one token. if success return true and advance i. if failure return false, don't need to restore i.
            function parse_one_token(token)
            {
                if (typeof token === 'string')
                {
                    if (token.toLowerCase() === text.substr(i,token.length).toLowerCase() 
                        && !(/[A-Z0-9_]/i.test(token[0]) && /[A-Z0-9_]/i.test(text[i+token.length]||'')))
                    {
                        i += token.length;
                        return true;
                    }
                }
                else if (token.regex)
                {
                    token.regex.lastIndex = i;
                    if (token.regex.test(text))
                    {
                        i = token.regex.lastIndex;
                        return true;
                    }
                }
                else if (token.rule)
                {
                    var result = parse_rule_versions(token.rule, token.rule_versions, token.first_version || 0);
                    if (result)
                    {
                        rule_results.push(result);
                        return true;
                    }
                }
                else if (token.bracket)
                {
                    var startI = i;
                    
                    if (parse_token_array(token.inner, true))
                    {
                        if (token.feature === '*')
                        {
                            while (parse_token_array(token.inner, true))
                            {
                            }
                        }
                        else if (token.feature === '@')
                        {
                            i = startI;
                            return (token.bracket === '{');
                        }
                        
                        return true;
                    }
                    else if (token.bracket === '[')
                    {
                        return true;
                    }
                    else if (token.feature === '@')
                    {
                        i = startI;
                        return (token.bracket === '[');
                    }
                }
                else if (token.choice)
                {
                    var choiceI = i, rule_results_length = rule_results.length;
                    for (var c = 0; c < token.choice.length; c++)
                    {
                        if (parse_token_array(token.choice[c], false))
                        {
                            return true;
                        }
                        i = choiceI;
                        rule_results.splice(rule_results_length);
                    }
                }
                
                return false;
            }
        }
		
	}
}


