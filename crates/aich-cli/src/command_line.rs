use aich_git::CheckCommand;

use crate::CliError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ProcessCommandSpec {
    pub(crate) program: String,
    pub(crate) args: Vec<String>,
}

impl ProcessCommandSpec {
    pub(crate) fn display(&self) -> String {
        let mut parts = vec![self.program.clone()];
        parts.extend(self.args.iter().cloned());
        parts.join(" ")
    }
}

pub(crate) fn parse_process_command(
    label: &str,
    command_line: &str,
) -> Result<ProcessCommandSpec, CliError> {
    let mut parts = split_command_line(command_line)
        .map_err(|error| CliError::Usage(format!("{label} has invalid command syntax: {error}")))?;
    if parts.is_empty() {
        return Err(CliError::Usage(format!("{label} must not be empty")));
    }
    let program = parts.remove(0);
    Ok(ProcessCommandSpec {
        program,
        args: parts,
    })
}

fn split_command_line(command_line: &str) -> Result<Vec<String>, String> {
    #[derive(Copy, Clone, Eq, PartialEq)]
    enum Quote {
        Single,
        Double,
    }

    let mut parts = Vec::new();
    let mut current = String::new();
    let mut quote: Option<Quote> = None;
    let mut has_current = false;

    let mut characters = command_line.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '\\' if quote != Some(Quote::Single) => {
                match characters.peek().copied() {
                    Some(next)
                        if next == '\\' || next == '\'' || next == '"' || next.is_whitespace() =>
                    {
                        current.push(characters.next().expect("peeked character"));
                    }
                    _ => current.push('\\'),
                }
                has_current = true;
            }
            '\'' if quote.is_none() => {
                quote = Some(Quote::Single);
                has_current = true;
            }
            '\'' if quote == Some(Quote::Single) => {
                quote = None;
                has_current = true;
            }
            '"' if quote.is_none() => {
                quote = Some(Quote::Double);
                has_current = true;
            }
            '"' if quote == Some(Quote::Double) => {
                quote = None;
                has_current = true;
            }
            value if value.is_whitespace() && quote.is_none() => {
                if has_current {
                    parts.push(std::mem::take(&mut current));
                    has_current = false;
                }
            }
            other => {
                current.push(other);
                has_current = true;
            }
        }
    }

    if quote.is_some() {
        return Err("command contains an unterminated quote".to_string());
    }
    if has_current {
        parts.push(current);
    }

    Ok(parts)
}

pub(crate) fn parse_check_command(
    name: &str,
    command_line: &str,
) -> Result<CheckCommand, CliError> {
    let mut parts = split_command_line(command_line).map_err(|error| {
        CliError::Usage(format!(
            "check command '{name}' has invalid syntax: {error}"
        ))
    })?;
    if parts.is_empty() {
        return Err(CliError::Usage(format!(
            "check command '{name}' must not be empty"
        )));
    }
    let program = parts.remove(0);

    Ok(CheckCommand {
        name: name.to_string(),
        program,
        args: parts,
    })
}

pub(crate) fn strip_yaml_scalar(value: &str) -> String {
    let value = value.trim();
    if value.len() >= 2 {
        let bytes = value.as_bytes();
        if (bytes[0] == b'"' && bytes[value.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[value.len() - 1] == b'\'')
        {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_command_line_preserves_quoted_arguments() {
        assert_eq!(
            split_command_line("reviewer --model \"gpt 5\" 'prompt file.md'").expect("split"),
            vec!["reviewer", "--model", "gpt 5", "prompt file.md"]
        );
    }

    #[test]
    fn split_command_line_preserves_windows_backslash_paths() {
        assert_eq!(
            split_command_line(
                r#"reviewer --script C:\Users\dev\aich\review.ps1 "prompt file.md""#
            )
            .expect("split"),
            vec![
                "reviewer",
                "--script",
                r"C:\Users\dev\aich\review.ps1",
                "prompt file.md"
            ]
        );
    }
}
