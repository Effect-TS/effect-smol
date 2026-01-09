#!/bin/bash

# Test Shell Completions Script
# Usage: ./test-completions.sh [bash|fish|zsh|all]

CLI_CMD="pnpm node examples/simple-cli/src/cli.ts"
SHELL_TYPE="${1:-all}"

echo "🚀 Testing Effect CLI Completions"
echo "================================="

setup_completion() {
    local shell="$1"
    echo "📝 Generating $shell completion script..."

    # Generate completion script
    $CLI_CMD --completions "$shell" > "/tmp/myapp-completion.$shell"

    case "$shell" in
        "bash")
            echo "🔧 Setting up bash completion..."
            source "/tmp/myapp-completion.$shell"
            ;;
        "fish")
            echo "🔧 Setting up fish completion..."
            # Fish completions are loaded automatically when sourced
            if command -v fish &> /dev/null; then
                fish -c "source /tmp/myapp-completion.fish"
                echo "Fish completion loaded (use in fish shell)"
            else
                echo "⚠️  Fish shell not found"
            fi
            ;;
        "zsh")
            echo "🔧 Setting up zsh completion..."
            # Check syntax first
            if zsh -n "/tmp/myapp-completion.zsh" 2>/dev/null; then
                echo "✅ Zsh completion syntax is valid"
                source "/tmp/myapp-completion.zsh"

                # Remove any existing alias and create function
                unalias myapp 2>/dev/null || true
                myapp() { $CLI_CMD "$@"; }

                # Register completion
                compdef _myapp_zsh_completions myapp
                echo "✅ Zsh completion registered for 'myapp' command"
            else
                echo "❌ Zsh completion has syntax errors"
                return 1
            fi
            ;;
    esac
}

test_completion() {
    local shell="$1"
    echo ""
    echo "🧪 Testing $shell completion..."
    echo "Generated completion file: /tmp/myapp-completion.$shell"
    echo ""

    case "$shell" in
        "bash")
            echo "To test bash completion:"
            echo "  source /tmp/myapp-completion.bash"
            echo "  alias myapp='$CLI_CMD'"
            echo "  myapp <TAB>    # Should show: build copy db deploy"
            echo "  myapp build <TAB>    # Should show flags"
            ;;
        "fish")
            echo "To test fish completion:"
            echo "  fish"
            echo "  source /tmp/myapp-completion.fish"
            echo "  alias myapp='$CLI_CMD'"
            echo "  myapp <TAB>    # Should show: build copy db deploy"
            ;;
        "zsh")
            if [[ $SHELL == *"zsh"* ]]; then
                echo "✨ You're in zsh! Try these commands:"
                echo "  myapp <TAB>         # Should show: build copy db deploy"
                echo "  myapp build <TAB>   # Should show: --minify --out-dir --target --watch"
                echo "  myapp deploy <TAB>  # Should show: production staging"
                echo "  myapp --<TAB>       # Should show: --config --log-level --verbose"
                echo ""
                echo "🎯 Quick test - type: myapp [TAB] to see completions"
            else
                echo "To test zsh completion:"
                echo "  zsh"
                echo "  source /tmp/myapp-completion.zsh"
                echo "  myapp() { $CLI_CMD \"\$@\"; }"
                echo "  compdef _myapp_zsh_completions myapp"
                echo "  myapp <TAB>    # Should show: build copy db deploy"
            fi
            ;;
    esac
}

case "$SHELL_TYPE" in
    "bash")
        setup_completion "bash"
        test_completion "bash"
        ;;
    "fish")
        setup_completion "fish"
        test_completion "fish"
        ;;
    "zsh")
        setup_completion "zsh"
        test_completion "zsh"
        ;;
    "all")
        echo "🌟 Setting up all shell completions..."
        echo ""

        setup_completion "bash"
        echo ""
        setup_completion "fish"
        echo ""
        setup_completion "zsh"

        echo ""
        echo "📋 Summary:"
        echo "==========="
        test_completion "bash"
        test_completion "fish"
        test_completion "zsh"
        ;;
    *)
        echo "❌ Unknown shell: $SHELL_TYPE"
        echo "Usage: $0 [bash|fish|zsh|all]"
        exit 1
        ;;
esac

echo ""
echo "📁 Generated completion files:"
ls -la /tmp/myapp-completion.* 2>/dev/null || echo "No completion files found"

echo ""
echo "🎉 Done! Your shell completions are ready to test."
