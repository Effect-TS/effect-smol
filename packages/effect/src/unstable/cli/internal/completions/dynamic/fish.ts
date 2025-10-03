/**
 * Dynamic Fish completion template.
 * This generates a completion script that calls the CLI at runtime to get completions.
 * Based on Fish's dynamic completion capabilities.
 */

/** @internal */
export const generateDynamicFishCompletion = (
  executableName: string,
  executablePath?: string
): string => {
  const appPath = executablePath || executableName

  const template = `###-begin-${executableName}-completions-###
#
# Effect CLI dynamic completion script for Fish
#
# Installation:
#   ${appPath} --completions fish >> ~/.config/fish/completions/${executableName}.fish
#   or ${appPath} --completions fish > ~/.config/fish/completions/${executableName}.fish
#

# Dynamic completion function for ${executableName}
function __${executableName}_complete
    # Get the current command line tokens
    set -l cmd (commandline -pco)
    set -l current (commandline -ct)

    # Calculate current word index (Fish uses 1-based indexing, but we need 0-based for compatibility)
    set -l cword (math (count $cmd) - 1)

    # Get the full command line for context
    set -l line (commandline -p)
    set -l point (string length "$line")

    # Call the CLI with Fish-specific environment variables to get completions
    # COMP_CWORD: Index of the current word being completed (0-based)
    # COMP_LINE: The full command line
    # COMP_POINT: Cursor position
    # FISH_COMPLETION: Flag to indicate Fish completion format

    set -l completions (
        env FISH_COMPLETION=1 \\
            COMP_CWORD="$cword" \\
            COMP_LINE="$line" \\
            COMP_POINT="$point" \\
            ${appPath} --get-completions $cmd 2>/dev/null
    )

    # Output completions - Fish handles descriptions automatically with tab separation
    for completion in $completions
        echo $completion
    end
end

# Register the completion function for ${executableName}
# -f: no file completion by default (let the CLI decide)
# -a: use the output of our function as arguments
complete -c ${executableName} -f -a '(__${executableName}_complete)'
###-end-${executableName}-completions-###
`

  return template
}
