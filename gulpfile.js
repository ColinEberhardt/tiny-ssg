var gulp = require('gulp');
require('babel-core/register');
var babel = require('gulp-babel');
var del = require('del');

gulp.task('clean', function() {
    del(['es5']);
});

gulp.task('babel', function() {
    return gulp.src('es6/*.js')
        .pipe(babel())
        .pipe(gulp.dest('es5'));
});

gulp.task('watch', function() {
    gulp.watch('es6/*.js', ['babel']);
});

gulp.task('default', ['watch']);
