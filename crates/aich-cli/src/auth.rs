use std::io::Write;
use std::path::Path;

use aich_core::clock::now_millis;
use aich_core::{Operator, OperatorRole};
use aich_ledger::Ledger;

use crate::options::{
    parse_auth_whoami_options, parse_operator_add_options, parse_operator_list_options,
    OperatorAddOptions,
};
use crate::{
    open_existing_ledger, usage_text, CliError, DEFAULT_OPERATOR_ID, DEFAULT_OPERATOR_NAME,
};
pub(crate) fn run_auth_command<W: Write>(
    args: &[String],
    cwd: &Path,
    out: &mut W,
) -> Result<(), CliError> {
    match args.first().map(String::as_str) {
        Some("whoami") => {
            let options = parse_auth_whoami_options(&args[1..], cwd)?;
            let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
            let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;

            writeln!(out, "Operator: {}", operator.id)?;
            writeln!(out, "Name: {}", operator.display_name)?;
            writeln!(out, "Role: {}", operator.role.as_str())?;
            writeln!(out, "Status: {}", operator.status.as_str())?;
            Ok(())
        }
        Some("operator") => run_auth_operator_command(&args[1..], cwd, out),
        Some("-h") | Some("--help") | None => Err(CliError::Usage(usage_text())),
        Some(command) => Err(CliError::Usage(format!(
            "unknown auth command '{command}'\n\n{}",
            usage_text()
        ))),
    }
}

fn run_auth_operator_command<W: Write>(
    args: &[String],
    cwd: &Path,
    out: &mut W,
) -> Result<(), CliError> {
    match args.first().map(String::as_str) {
        Some("add") => {
            let options = parse_operator_add_options(&args[1..], cwd)?;
            let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
            let operator = upsert_operator_from_options(&ledger, &options)?;

            writeln!(out, "Saved operator {}", operator.id)?;
            writeln!(out, "Name: {}", operator.display_name)?;
            writeln!(out, "Role: {}", operator.role.as_str())?;
            writeln!(out, "Status: {}", operator.status.as_str())?;
            Ok(())
        }
        Some("list") => {
            let options = parse_operator_list_options(&args[1..], cwd)?;
            let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
            let operators = ledger.list_operators()?;

            writeln!(out, "Operators: {}", operators.len())?;
            for operator in operators {
                writeln!(
                    out,
                    "- {} [{} / {}] {}",
                    operator.id,
                    operator.role.as_str(),
                    operator.status.as_str(),
                    operator.display_name
                )?;
            }
            Ok(())
        }
        Some("-h") | Some("--help") | None => Err(CliError::Usage(usage_text())),
        Some(command) => Err(CliError::Usage(format!(
            "unknown auth operator command '{command}'\n\n{}",
            usage_text()
        ))),
    }
}

pub(crate) fn ensure_default_operator(ledger: &Ledger) -> Result<Operator, CliError> {
    if let Some(operator) = ledger.get_operator(DEFAULT_OPERATOR_ID)? {
        return Ok(operator);
    }

    let now = now_millis();
    let operator = Operator::new(
        DEFAULT_OPERATOR_ID,
        DEFAULT_OPERATOR_NAME,
        OperatorRole::Owner,
        now,
    )
    .map_err(CliError::Usage)?;
    ledger.upsert_operator(&operator)?;
    Ok(operator)
}

pub(crate) fn resolve_active_operator(
    ledger: &Ledger,
    requested_operator_id: Option<&str>,
) -> Result<Operator, CliError> {
    let operator_id = match requested_operator_id {
        Some(value) if value.trim().is_empty() => {
            return Err(CliError::Usage("--operator must not be empty".to_string()));
        }
        Some(value) => value.trim().to_string(),
        None => DEFAULT_OPERATOR_ID.to_string(),
    };

    let operator = if operator_id == DEFAULT_OPERATOR_ID {
        ensure_default_operator(ledger)?
    } else {
        ledger.get_operator(&operator_id)?.ok_or_else(|| {
            CliError::Usage(format!(
                "operator '{operator_id}' does not exist; run `aich auth operator add --id {operator_id}` first"
            ))
        })?
    };

    if !operator.is_active() {
        return Err(CliError::Usage(format!(
            "operator '{}' is disabled",
            operator.id
        )));
    }

    Ok(operator)
}

fn upsert_operator_from_options(
    ledger: &Ledger,
    options: &OperatorAddOptions,
) -> Result<Operator, CliError> {
    let now = now_millis();
    let existing = ledger.get_operator(&options.id)?;
    let created_at_ms = existing
        .as_ref()
        .map(|operator| operator.created_at_ms)
        .unwrap_or(now);
    let display_name = options
        .display_name
        .clone()
        .or_else(|| {
            existing
                .as_ref()
                .map(|operator| operator.display_name.clone())
        })
        .unwrap_or_else(|| options.id.clone());

    let mut operator = Operator::new(
        options.id.clone(),
        display_name,
        options.role,
        created_at_ms,
    )
    .map_err(CliError::Usage)?;
    operator.updated_at_ms = now;
    ledger.upsert_operator(&operator)?;
    Ok(operator)
}
