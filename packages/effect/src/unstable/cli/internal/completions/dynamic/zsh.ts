/**
 * Dynamic Zsh completion template.
 * This generates a completion script that calls the CLI at runtime to get completions.
 * Based on the yargs completion approach but adapted for Effect CLI.
 */

/** @internal */
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
  emulate -L zsh -o no_aliases
  setopt local_options nonomatch extendedglob
  compstate[insert]=menu

  local -a reply _${executableName}_options _${executableName}_commands _${executableName}_values
  local _${executableName}_line _${executableName}_tag _${executableName}_data _${executableName}_file_kind=""
  local ret=1 si=$IFS

  local _EFFECT_STYLES_VAR="_EFFECT_CLI_${executableName}_STYLES_INITIALIZED"
  if [[ -z \${(P)_EFFECT_STYLES_VAR} ]]; then
    zstyle ':completion:*:*:${executableName}:*' group-name ''
    zstyle ':completion:*:*:${executableName}:*' verbose yes
    zstyle ':completion:*:*:${executableName}:*' menu select=long-list
    zstyle ':completion:*:*:${executableName}:*' tag-order 'commands' 'options' 'values' 'files'
    zstyle ':completion:*:*:${executableName}:*:commands' format ''
    zstyle ':completion:*:*:${executableName}:*:options' format ''
    zstyle ':completion:*:*:${executableName}:*:values' format ''
    [[ -n $LS_COLORS ]] && zstyle ':completion:*:*:${executableName}:*' list-colors \${(s.:.)LS_COLORS}
    typeset -g "_EFFECT_CLI_${executableName}_STYLES_INITIALIZED=1"
  fi

  IFS=$'\\n' reply=($(
    EFFECT_COMPLETION_FORMAT="zsh" \\
    COMP_CWORD="$((CURRENT-1))" \\
    COMP_LINE="$BUFFER" \\
    COMP_POINT="$CURSOR" \\
    ${appPath} --get-completions "\${words[@]}"
  ))
  IFS=$si

  for _${executableName}_line in "\${reply[@]}"; do
    [[ -z "\${_${executableName}_line}" ]] && continue

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
      files)
        _${executableName}_file_kind="\${_${executableName}_data}"
        ;;
      *)
        _${executableName}_values+=("\${_${executableName}_data}")
        ;;
    esac
  done

  if [[ -n "\${_${executableName}_file_kind}" ]]; then
    case "\${_${executableName}_file_kind}" in
      directory)
        _files -/ && return 0
        ;;
      path|either)
        _files && return 0
        ;;
      file)
        _files -g '*' && return 0
        ;;
    esac
  fi

  if (( \${#_${executableName}_commands[@]} > 0 )); then
    _describe -t commands 'commands' _${executableName}_commands && ret=0
  fi

  if (( \${#_${executableName}_options[@]} > 0 )); then
    _describe -t options 'options' _${executableName}_options && ret=0
  fi

  if (( \${#_${executableName}_values[@]} > 0 )); then
    compadd -Q -- "\${_${executableName}_values[@]}" && ret=0
  fi

  (( ret )) && _default

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
