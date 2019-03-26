
/**********************************************************************************************
*
* Btx-Server von Norbert Kehrer, March/April 2016
*
* http://members.aon.at/nkehrer
*
***********************************************************************************l************/



// *** External modules

var fs = require("fs");



// *** Constants

var BTX_CRLF	= String.fromCharCode(0x0d) + String.fromCharCode(0x0a);
var BTX_UML		= String.fromCharCode(0xc9);

var BTX_EINGABEZEILE = 	String.fromCharCode(0x1b) + // Hintergrund blau ganze Reihe
						String.fromCharCode(0x23) +
						String.fromCharCode(0x21) +
						String.fromCharCode(0x54) +
						String.fromCharCode(0x44) +	// Hintergrund blau, Vordergrund gelb
						String.fromCharCode(0x83);

var BTX_INIT_SCREEN = new Buffer([
		0x1f, 0x2f, 0x42,					// Grundzustand parallel
		0x9b,
		0x30, 0x32, 0x3b, 0x32, 0x33, 0x55,	// Scrollbereich ist Zeile 2 - 23
		0x9b,
		0x32, 0x60,							// Implizites Scrollen an
		0x1b, 0x23, 0x21, 0x54, 			// Hintergrund blau ganze Reihe
		0x94, 0x83,							// Hintergrund blau, Vordergrund gelb
		0x42, 0x74, 0x78, 0x20, 0x53, 0x65, 0x72, 0x76, 0x65, 0x72, // Btx Server
		0x20, 0x2d, 0x20, 0x4E, 0x6F, 0x72, 0x62, 0x65, 0x72, 0x74, //  - Norbert
		0x20, 0x4B, 0x65, 0x68, 0x72, 0x65, 0x72, 0x2c, 0x20,		// Kehrer, 
		0x41, 0x70, 0x72, 0x69, 0x6C, 0x20, 0x32, 0x30, 0x31, 0x36,	// April 2016 
		0x90, 0x87,							// Hintergrund schwarz, Vordergrund weiß
		0x0d, 0x0a,							// CR/LF
		0x11								// Cursor on
	]);




// *** Globals

var last_file 		= "";
var current_file 	= "";
var links 			= {}; 
var infile_links	= {}; 		// Link information within the BTX file (Germany only?)
var working_dir 	= "./pages/";
var country			= "AT";
var trace 			= true;


// *** Get command line arguments: argument1 = name of serial port (e.g. COM2), argument2 = Baud rate (e.g. 4800);

var args = process.argv.slice(2);

var serial_port_name = "COM3";	// default: COM2
var baud_rate = 4800;			// default: 4800 Baud

if ((args[0] !== "") & (args[0] !== undefined)) {
	serial_port_name = args[0];
};

if ((args[1] !== "") & (args[1] !== undefined)) {
	baud_rate = parseInt(args[1]);
};


// *** Serial port initialization

//var SerialPort = require("../nodejs/node_modules/serialport/serialport.js").SerialPort;
var SerialPort = require("serialport");

var serialPort = new SerialPort(serial_port_name, {
	baudRate: baud_rate,
	dataBits: 8,
	parity:   "none",
	stopBits: 1
});



// *** Serial port events

serialPort.on("open", function () {
	console.log("Serial port was opened.");
});


serialPort.on("data", function (data) {
	process_serial_data(data.toString("binary"));
});


serialPort.on("error", function (data) {
	console.log("Serial port error: " + data);
});


serialPort.on("close", function (err) {
	if (err) {
		console.log("Error closing serial port: " + err);
	};
});



// *** Server

var command_line = "";
var command_status = 0;

var screen_needs_to_be_initialized = true;


function process_serial_data (data) {
	if (screen_needs_to_be_initialized) {
		write_serial_binary_buffer(BTX_INIT_SCREEN);
		screen_needs_to_be_initialized = false;
	};
	for (var i = 0; i < data.length; i++) {
		process_serial_byte(data[i]);
	};
};


function process_serial_byte (data) {
	console.log("curr file is now: " + current_file);
	if (trace) {
		console.log("char received: " + data.charCodeAt(0) + " --> " + data);
	};
	var char_code = data.charCodeAt(0);
	var echo_char = data;
	// if the entered character is the first in the commandline and is a link to another page, send that other page
	if ((command_line === "") && (links[data])) {
		console.log(echo_char + " link = " + links[data]);
		send_file(links[data]); 
	}
	else {
		if (char_code === 19) { 		// map special characters (*, #) to readable form
			echo_char = "*";
		};
		if (char_code === 28) {
			echo_char = "#";
		};
		write_serial(echo_char);		// echo character on the Btx terminal
		if ((char_code === 13) || (char_code === 26) || (char_code === 28)) { 	// if "Return", or "SEND", or "#" key was pressed
			process_command(command_line, char_code);
			command_line = "";
		}
		else if (char_code === 8) {			// backspace character
			command_line = command_line.substr(0, command_line.length - 1);
		}
		else {
			command_line = command_line + data;
		};
	};
};



// *** Command line interpreter

function process_command (cmd_line, terminating_character) {

	cmd_line.trim(); 	// remove leading and trailing whitespace

	// Special treatment for single # ... load next page (if last page was not not empty)
	if ((cmd_line === "") && (terminating_character === 28) && (current_file !== "")) {
		if (infile_links["#"]) {			// if the file is a menu link according to German standard
			send_file(infile_links["#"]); 		// send the file
		}
		else {									// else it is the "Folgeseite"
			var last_char = current_file.charCodeAt(current_file.length - 1); 					// get code of last char of filename
			var next_file = current_file.slice(0, -1) + String.fromCharCode(last_char + 1); 	// and replace it by the next in the alphabet
			send_file(next_file); 
		};
	};

	// Special treatment for page requests: *...#    *=19, #=28
	if (cmd_line.charCodeAt(0) === 19) {
		send_file(cmd_line.slice(1)); 	// strip off first char (the *) to get the file name, and send that file
	}

	// Special treatment for menu selection (digits only were entered, without the * and the #):
	else if (cmd_line.match(/^[0-9]+$/)) {
		if (infile_links[cmd_line]) {			// if the file is a menu link according to German standard
			send_file(infile_links[cmd_line]); 	// send the file
		};
	}

	// All normal commands:
	else {

	// Commands

		var cmd_words = cmd_line.split(" ");
		writeln_serial("");
		switch (cmd_words[0]) {

			case "":
				break;

			case "dir":
			case "ls":
				var dir_list = fs.readdirSync(process.cwd());
				// var btx_dir_listing = "";
				// for (var i = 0; i < dir_list.length; i++) {
				// 	var fname = dir_list[i];
				// 	var stats = fs.statSync(working_dir + fname);
				// 	if (stats.isDirectory()) {
				// 		fname = fname + "/";
				// 	};
				// 	var fname_trunc = (fname + "                                        ").substr(0, 24);
				// 	var size_trunc = ("          " + stats.size);
				// 	size_trunc = size_trunc.substr(size_trunc.length - 10, 10);
				// 	btx_dir_listing = btx_dir_listing + fname_trunc + " " + size_trunc + BTX_CRLF;
				// };
				var btx_dir_listing = "";
				for (var i = 0; i < dir_list.length; i++) {
					var fname = dir_list[i];
					var stats = fs.statSync(process.cwd() + "/" + fname);
					if (stats.isDirectory()) {
						fname = fname + "/";
					};
					var fname_trunc = (fname + "                      ").substr(0, 19);
					btx_dir_listing += fname_trunc;
					if ((i % 2) === 0) {
						btx_dir_listing += " ";
					}
					else {
						btx_dir_listing += BTX_CRLF;
					};
				};
				if ((dir_list.length % 2) !== 0) {
					btx_dir_listing += BTX_CRLF;
				};
				write_serial(btx_dir_listing);
				break;

			case "cd":
				var new_dir = cmd_words[1];
				try {
					process.chdir(new_dir);
				}
				catch (err) {
					writeln_serial(err);
				};
				break;

			case "pwd":
					writeln_serial(process.cwd());
				break;

			case "cls":
				write_serial_binary_buffer(BTX_INIT_SCREEN);
				break;

			case "at":
				country = "AT";
				write_serial_binary_buffer(BTX_UML + "Osterreichisches BTX-System.");
				break;

			case "de":
				country = "DE";
				write_serial_binary_buffer("Deutsches BTX noch nicht implementiert.");
				break;

			case "log":
				trace = true;
				break;

			case "nolog":
				trace = false;
				break;

			case "?":
			case "help":
				writeln_serial("BTX-Server von Norbert Kehrer");	
				writeln_serial(" ");
				writeln_serial("Befehle:");	
				writeln_serial(" ");
				//              0123456789012345678901234567890123456789	
				writeln_serial("*nnn#   Seite bzw. File nnn anzeigen");	
				writeln_serial("cls     Bildschirm l" + BTX_UML + "oschen");
				writeln_serial("dir     Dateien im Verzeichnis anzeigen");
				writeln_serial("ls      Dateien im Verzeichnis anzeigen");
				writeln_serial("cd      Verzeichnis wechseln");	
				writeln_serial("pwd     Aktuelles Verzeichnis anzeigen");	
				writeln_serial("at      " + BTX_UML +"Osterreichisches BTX-System");	
				writeln_serial("de      Deutsches BTX-System");	
				writeln_serial("log     Gesendete Zeichen anzeigen");	
				writeln_serial("nolog   Log ausschalten");	
				break;

			default:
				writeln_serial("Unbekannter Befehl: " + cmd_words[0]);	
				break;
		};
	};
};



function send_file (file_name) {
	// Find the linkage info for Austria (same file in info directory)
	find_linkage_info_austria (file_name);
	// Read and send the file itself
	try {
		var file_contents_buffer = fs.readFileSync(process.cwd() + "/" + file_name);
		write_serial_binary_buffer(file_contents_buffer); 
		// Find the linkage info for Germany (KEY definitions within the CEPT file)
		find_linkage_info_germany(file_contents_buffer.toString());
		last_file = current_file;
		current_file = file_name;
	}
	catch (e) {
			writeln_serial("");
			writeln_serial("Datei nicht gefunden: " + file_name + BTX_CRLF + e);
	};
};


function find_linkage_info_austria (file_name) {
	links = {};			// new page, new links
	// Check, if there is a link file, and build a link associative array, if so
	// Format of link file is like that: <0Page1 1PAGE2 2testpage!
	var link_file_buffer;
	var link_file_exists = false;
	try {
		var link_file_buffer = fs.readFileSync(process.cwd() + "/info/" + file_name);
		console.log("lfb = " + link_file_buffer);
		link_file_exists = true;
	}
	catch (e) {
		// do nothing, if link file is not there
		link_file_exists = false;
	};
	if (link_file_exists) {
		var links_match = link_file_buffer.toString().match(/.*<([^!]+)!.*/);	// get the string between < and !
		if (links_match !== null) {
			var links_string = links_match[1]; 									// first match of parentheses expression above
			var link_array = links_string.trim().split(/\s+/);					// remove leading and trailing spaces and split it into an array
			for (var i = 0; i < link_array.length; i++) {
				var l = link_array[i];
				links[l.charAt(0)] = l.substr(1); 							// link is like so: 1 char = option, rest = file to load
			};
		};
		var str = JSON.stringify(links, null, 4); // (Optional) beautifully indented output.
		console.log("links = " + str);
	};
};


function find_linkage_info_germany (file_contents) {
	infile_links = {};
	var linkage = file_contents.match(/\x1f\x3d([^\x1f\x9b\x1b]+)/g);
	if (linkage) {
		for (var i = 0; i < linkage.length; i++) {
			var entry = linkage[i];
			if (entry.charAt(2) !== "0") {
				var menu_item = entry.substr(3, 2).trim();
				var item_text = entry.substr(5).trim();
				infile_links[menu_item] = item_text;
			};
		};
		var str = JSON.stringify(infile_links, null, 4); // (Optional) beautifully indented output.
		console.log("linkage = " + str);
	};
};



// *** Main program

console.log("");
console.log("**************************************");
console.log("*                                    *");
console.log("*   B T X - S e r v e r              *");
console.log("*                                    *");
console.log("**************************************");
console.log("*                                    *");
console.log("*   von Norbert Kehrer               *");
console.log("*   http://members.aon.at/nkehrer/   *");
console.log("*                                    *");
console.log("*   März und April 2016              *");
console.log("*                                    *");
console.log("**************************************");
console.log("\n");
console.log("Serial port: " + serial_port_name);
console.log("Baud rate:   " + baud_rate);
console.log("\n");



process.chdir("pages");



// *** Utilities

function write_serial_binary_buffer (data_buffer) {
	serialPort.write(data_buffer, function (err, results) {
		if (err) {
			console.log("Error writing to serial port: " + err);
		}
	});
};


function write_serial (data) {
	serialPort.write(data, function (err, results) {
		if (err) {
			console.log("Error writing to serial port: " + err);
		}
	});
};


function writeln_serial (data) {
	write_serial(data + BTX_CRLF);
};



