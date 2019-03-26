# btxserver
Server for the videotex system (Bildschirmtext)


BTX-Server 
==========

April 2016


What is it?
-----------

BTX-Server is a simple and still buggy server for old Videotex-Systems (called BTX in Austria and Germany).



How to install?
---------------

Step 1: Set up the directory

Put the file "btx_server.js" into a directory. Make a subdirectory called "pages", which contain your BTX pages in CEPT code. 


Step 2: Install node.js

BTX-Server is written in JavaScript for node.js, so you need to install Node.js on your machine. You get it from http://nodejs.org


Step 3: Install serialport

You will need node.js support for a serial connection on your PC. To get this just install a node.js package called "serialport" with the command "npm install serialport".


Step 4: Connect the PC with the Videotex decoder

The connection of your computer with Videotex decoder depends on your hardware. Often it works via a USB-to-RS/232 plug, where one end goes into your PC via USB and the other end to your Videotex decoder.



How to use?
-----------

Set up a serial port connection between you PC and your Videotex decoder. Then, on your PC start the BTX server with "node btx_server.js <name of serial port> <Baud rate>".

Example to start the server from the command line: node btx_server.js COM2 4800

On the Videotex decoder you can then call up a Videotex page or enter a command like so:

*nnnn# ... Show file / page nnnn on the Videotex decoder
cls ...... Clear the screen
dir ...... List directory
ls ....... List directory
cd ....... Change directory
pwd ...... Print current directory
log ...... Log the sent characters
nolog .... Turn off the logging


Norbert Kehrer, April 2016

http://members.aon.at/~nkehrer/









