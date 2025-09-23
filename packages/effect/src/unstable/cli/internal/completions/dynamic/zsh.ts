/**
 * Dynamic Zsh completion template.
 * This generates a completion script that calls the CLI at runtime to get completions.
 * Based on the yargs completion approach but adapted for Effect CLI.
 */

export const generateDynamicZshCompletion = (
  executableName: string,
  executablePath?: string
): string => {
  const appPath = executablePath || executableName

  const template = `#compdef ${executableName}
###-begin-${executableName}-completions-###
#
# Effect CLI dynamic completion script for Zsh
#
# Installation:
#   ${appPath} --completions zsh >> ~/.zshrc
#   or ${appPath} --completions zsh >> ~/.zprofile on OSX.
#
_${executableName}_dynamic_completions()
{
  local reply
  local si=$IFS

  # Call the CLI with special environment variables to get completions
  # COMP_WORDS: All words in the current command line
  # COMP_CWORD: Index of the current word being completed
  # COMP_LINE: The full command line
  # COMP_POINT: Cursor position

  IFS=$'\\n' reply=($(
    COMP_TYPE="9" \\
    COMP_CWORD="$((CURRENT-1))" \\
    COMP_LINE="$BUFFER" \\
    COMP_POINT="$CURSOR" \\
    ${appPath} --get-completions "\${words[@]}"
  ))
  IFS=$si

  # If we got completions, describe them
  if [[ \${#reply} -gt 0 ]]; then
    _describe 'values' reply
  else
    # Fall back to default completion (files)
    _default
  fi
}

# Handle both direct invocation and autoload
if [[ "\${zsh_eval_context[-1]}" == "loadautofunc" ]]; then
  _${executableName}_dynamic_completions "$@"
else
  compdef _${executableName}_dynamic_completions ${executableName}
fi
###-end-${executableName}-completions-###
`

  return template
}
