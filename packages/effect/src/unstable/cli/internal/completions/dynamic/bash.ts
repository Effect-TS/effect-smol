/**
 * Dynamic Bash completion template.
 * This generates a completion script that calls the CLI at runtime to get completions.
 */

/** @internal */
export const generateDynamicBashCompletion = (
  executableName: string,
  executablePath?: string
): string => {
  const appPath = executablePath || executableName

  const template = `###-begin-${executableName}-completions-###
#
# Effect CLI dynamic completion script for Bash
#
# Installation:
#   ${appPath} --completions bash >> ~/.bashrc
#   or ${appPath} --completions bash >> ~/.bash_profile on OSX.
#
_${executableName}_dynamic_completions()
{
  local cur prev words cword

  # Initialize bash completion variables
  _init_completion || return

  local IFS=$'\\n'

  # Call the CLI with special environment variables to get completions
  # COMP_WORDS: All words in the current command line
  # COMP_CWORD: Index of the current word being completed
  # COMP_LINE: The full command line
  # COMP_POINT: Cursor position
  # COMP_TYPE: Type of completion (9 = normal, 63 = listing)

  local completions="$(
    COMP_TYPE=9 \\
    COMP_CWORD="$COMP_CWORD" \\
    COMP_LINE="$COMP_LINE" \\
    COMP_POINT="$COMP_POINT" \\
    ${appPath} --get-completions "\${COMP_WORDS[@]}"
  )"

  # Convert completions to array
  COMPREPLY=( $(compgen -W "$completions" -- "$cur") )

  # If no completions, fall back to file completion
  if [[ \${#COMPREPLY[@]} -eq 0 ]]; then
    _filedir
  fi

  return 0
}

complete -F _${executableName}_dynamic_completions ${executableName}
###-end-${executableName}-completions-###
`

  return template
}
