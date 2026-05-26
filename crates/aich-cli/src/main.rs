use std::io;
use std::process;

fn main() {
    let cwd = match std::env::current_dir() {
        Ok(cwd) => cwd,
        Err(error) => {
            eprintln!("error: failed to read current directory: {error}");
            process::exit(1);
        }
    };

    let mut stdout = io::stdout();
    if let Err(error) = aich_cli::run_with_cwd(std::env::args(), &cwd, &mut stdout) {
        eprintln!("error: {error}");
        process::exit(1);
    }
}
