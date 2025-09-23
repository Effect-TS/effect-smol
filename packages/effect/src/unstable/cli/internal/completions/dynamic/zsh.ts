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
    EFFECT_COMPLETION_FORMAT="zsh" \\
    COMP_TYPE="9" \\
    COMP_CWORD="$((CURRENT-1))" \\
    COMP_LINE="$BUFFER" \\
    COMP_POINT="$CURSOR" \\
    ${appPath} --get-completions "\${words[@]}"
  ))
  IFS=$si

  typeset -a _${executableName}_options _${executableName}_commands _${executableName}_values
  local _${executableName}_line _${executableName}_tag _${executableName}_data

  for _${executableName}_line in "\${reply[@]}"; do
    if [[ -z "\${_${executableName}_line}" ]]; then
      continue
    fi

    if [[ "\${_${executableName}_line}" != *$'\\t'* ]]; then
      _${executableName}_values+=("\${_${executableName}_line}")
      continue
    fi

    _${executableName}_tag="\${_${executableName}_line%%$'\\t'*}"
    _${executableName}_data="\${_${executableName}_line#*$'\\t'}"

    case "\${_${executableName}_tag}" in
      option)
        _${executableName}_options+=("\${_${executableName}_data}")
        ;;
      command)
        _${executableName}_commands+=("\${_${executableName}_data}")
        ;;
      value)
        _${executableName}_values+=("\${_${executableName}_data}")
        ;;
      *)
        _${executableName}_values+=("\${_${executableName}_data}")
        ;;
    esac
  done

  local ret=1

  if (( \${#_${executableName}_commands[@]} > 0 )); then
    _describe -t commands 'commands' _${executableName}_commands && ret=0
  fi

  if (( \${#_${executableName}_options[@]} > 0 )); then
    _describe -t options 'options' _${executableName}_options && ret=0
  fi

  if (( \${#_${executableName}_values[@]} > 0 )); then
    compadd -- "\${_${executableName}_values[@]}" && ret=0
  fi

  if (( ret )); then
    _default
  fi

  return ret
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
